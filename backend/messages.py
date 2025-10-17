# backend/messages.py
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from _firebase import get_db_ref
from protected import verify_token_from_header
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
import base64
import time
import secrets
import asyncio

router = APIRouter()


class SendMessageRequest(BaseModel):
    encrypted_message: str  # Base64 encoded encrypted message


class MarkReadRequest(BaseModel):
    message_id: str


def encrypt_message_server(message: str, aes_key_base64: str) -> str:
    """
    Encrypt message using AES-256-CBC (server-side encryption)
    This matches the frontend crypto.js implementation
    """
    # Decode the base64 AES key
    aes_key = base64.b64decode(aes_key_base64)

    # Generate random IV (16 bytes for AES)
    iv = secrets.token_bytes(16)

    # Pad the message
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(message.encode('utf-8')) + padder.finalize()

    # Encrypt
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv),
                    backend=default_backend())
    encryptor = cipher.encryptor()
    encrypted = encryptor.update(padded_data) + encryptor.finalize()

    # Combine IV and encrypted data, then base64 encode
    combined = iv + encrypted
    return base64.b64encode(combined).decode('utf-8')


def decrypt_message_server(encrypted_base64: str, aes_key_base64: str) -> str:
    """
    Decrypt message using AES-256-CBC (server-side decryption)
    """
    # Decode the base64 AES key
    aes_key = base64.b64decode(aes_key_base64)

    # Decode the encrypted data
    combined = base64.b64decode(encrypted_base64)

    # Split IV and encrypted data
    iv = combined[:16]
    encrypted = combined[16:]

    # Decrypt
    cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv),
                    backend=default_backend())
    decryptor = cipher.decryptor()
    padded_data = decryptor.update(encrypted) + decryptor.finalize()

    # Unpad
    unpadder = padding.PKCS7(128).unpadder()
    data = unpadder.update(padded_data) + unpadder.finalize()

    return data.decode('utf-8')


@router.post("/chat/{chat_id}/send")
async def send_message(chat_id: str, body: SendMessageRequest, request: Request):
    """
    Send an encrypted message in a chat
    Message arrives encrypted from frontend, we store it as-is
    """
    # Verify the requesting user
    payload = verify_token_from_header(request)
    sender_uid = payload.get("uid")

    # Verify chat exists and user is participant
    chat_ref = get_db_ref(f"/chats/{chat_id}")
    chat_data = chat_ref.get()

    if not chat_data:
        raise HTTPException(status_code=404, detail="Chat not found")

    participants = chat_data.get("participants", {})
    if sender_uid not in participants:
        raise HTTPException(
            status_code=403, detail="You are not a participant in this chat")

    # Create message entry
    messages_ref = get_db_ref(f"/chats/{chat_id}/messages")
    new_message_ref = messages_ref.push()
    message_id = new_message_ref.key

    current_time = int(time.time())

    message_data = {
        "message_id": message_id,
        "sender_uid": sender_uid,
        "encrypted_text": body.encrypted_message,
        "timestamp": current_time,
        "status": "unread",
        "read_at": None,
        "expires_at": None  # Will be set when message is read
    }

    new_message_ref.set(message_data)

    # Update chat metadata to track unread messages for each participant
    for uid in participants.keys():
        if uid != sender_uid:  # Don't mark as unread for sender
            unread_ref = get_db_ref(
                f"/users/{uid}/chats/{chat_id}/unread_count")
            current_unread = unread_ref.get() or 0
            unread_ref.set(current_unread + 1)

    return {
        "message_id": message_id,
        "status": "sent",
        "timestamp": current_time
    }


@router.get("/chat/{chat_id}/messages")
async def get_messages(chat_id: str, request: Request):
    """
    Get all messages in a chat
    Returns encrypted messages that will be decrypted on frontend
    """
    # Verify the requesting user
    payload = verify_token_from_header(request)
    user_uid = payload.get("uid")

    # Verify chat exists and user is participant
    chat_ref = get_db_ref(f"/chats/{chat_id}")
    chat_data = chat_ref.get()

    if not chat_data:
        raise HTTPException(status_code=404, detail="Chat not found")

    participants = chat_data.get("participants", {})
    if user_uid not in participants:
        raise HTTPException(
            status_code=403, detail="You are not a participant in this chat")

    # Get messages
    messages_ref = get_db_ref(f"/chats/{chat_id}/messages")
    messages_data = messages_ref.get() or {}

    messages_list = []
    current_time = int(time.time())

    for msg_id, msg in messages_data.items():
        # Skip expired messages
        expires_at = msg.get("expires_at")
        if expires_at and current_time >= expires_at:
            continue

        messages_list.append({
            "message_id": msg.get("message_id", msg_id),
            "sender_uid": msg.get("sender_uid"),
            "encrypted_text": msg.get("encrypted_text"),
            "timestamp": msg.get("timestamp"),
            "status": msg.get("status"),
            "read_at": msg.get("read_at"),
            "expires_at": msg.get("expires_at")
        })

    # Sort by timestamp
    messages_list.sort(key=lambda x: x.get("timestamp", 0))

    return {
        "messages": messages_list,
        "aes_key": chat_data.get("aes_key")
    }


@router.post("/chat/{chat_id}/mark-read")
async def mark_message_read(chat_id: str, body: MarkReadRequest, request: Request):
    """
    Mark a message as read and start the 1-minute expiration timer
    """
    # Verify the requesting user
    payload = verify_token_from_header(request)
    user_uid = payload.get("uid")

    # Verify chat exists and user is participant
    chat_ref = get_db_ref(f"/chats/{chat_id}")
    chat_data = chat_ref.get()

    if not chat_data:
        raise HTTPException(status_code=404, detail="Chat not found")

    participants = chat_data.get("participants", {})
    if user_uid not in participants:
        raise HTTPException(
            status_code=403, detail="You are not a participant in this chat")

    # Update message status
    message_ref = get_db_ref(f"/chats/{chat_id}/messages/{body.message_id}")
    message_data = message_ref.get()

    if not message_data:
        raise HTTPException(status_code=404, detail="Message not found")

    current_time = int(time.time())
    expires_at = current_time + 60  # 1 minute from now

    # Only mark as read if it's currently unread
    if message_data.get("status") == "unread":
        message_ref.update({
            "status": "read",
            "read_at": current_time,
            "expires_at": expires_at
        })

        # Decrement unread count for this user
        unread_ref = get_db_ref(
            f"/users/{user_uid}/chats/{chat_id}/unread_count")
        current_unread = unread_ref.get() or 0
        new_unread = max(0, current_unread - 1)
        unread_ref.set(new_unread)

    return {
        "status": "read",
        "expires_at": expires_at,
        "read_at": current_time
    }


@router.post("/chat/{chat_id}/mark-all-read")
async def mark_all_messages_read(chat_id: str, request: Request):
    """
    Mark all unread messages as read when user opens the chat
    Starts 1-minute timer for all unread messages
    """
    # Verify the requesting user
    payload = verify_token_from_header(request)
    user_uid = payload.get("uid")

    # Verify chat exists and user is participant
    chat_ref = get_db_ref(f"/chats/{chat_id}")
    chat_data = chat_ref.get()

    if not chat_data:
        raise HTTPException(status_code=404, detail="Chat not found")

    participants = chat_data.get("participants", {})
    if user_uid not in participants:
        raise HTTPException(
            status_code=403, detail="You are not a participant in this chat")

    # Get all messages
    messages_ref = get_db_ref(f"/chats/{chat_id}/messages")
    messages_data = messages_ref.get() or {}

    current_time = int(time.time())
    expires_at = current_time + 60  # 1 minute from now

    marked_count = 0
    for msg_id, msg in messages_data.items():
        # Only mark messages that are unread and not sent by current user
        if msg.get("status") == "unread" and msg.get("sender_uid") != user_uid:
            message_ref = get_db_ref(f"/chats/{chat_id}/messages/{msg_id}")
            message_ref.update({
                "status": "read",
                "read_at": current_time,
                "expires_at": expires_at
            })
            marked_count += 1

    # Reset unread count for this user
    if marked_count > 0:
        unread_ref = get_db_ref(
            f"/users/{user_uid}/chats/{chat_id}/unread_count")
        unread_ref.set(0)

    return {
        "marked_count": marked_count,
        "expires_at": expires_at
    }


async def cleanup_expired_messages():
    """
    Background task to periodically delete expired messages
    Should be called from main.py on startup
    """
    while True:
        try:
            current_time = int(time.time())

            # Get all chats
            chats_ref = get_db_ref("/chats")
            chats_data = chats_ref.get() or {}

            for chat_id, chat in chats_data.items():
                messages = chat.get("messages", {})

                for msg_id, msg in messages.items():
                    expires_at = msg.get("expires_at")

                    # Delete if expired
                    if expires_at and current_time >= expires_at:
                        message_ref = get_db_ref(
                            f"/chats/{chat_id}/messages/{msg_id}")
                        message_ref.delete()
                        print(
                            f"Deleted expired message {msg_id} from chat {chat_id}")

            # Wait 10 seconds before next check
            await asyncio.sleep(10)

        except Exception as e:
            print(f"Error in cleanup_expired_messages: {e}")
            await asyncio.sleep(10)
