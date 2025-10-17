# backend/chat.py
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from _firebase import get_db_ref
from protected import verify_token_from_header
from crypto_utils import (
    generate_dh_keypair,
    compute_shared_secret,
    derive_aes_key
)
import time

router = APIRouter()


class ChatInitRequest(BaseModel):
    peer_email: EmailStr
    public_key: str  # Base64 encoded DH public key from frontend


@router.post("/chat/init")
async def initialize_chat(body: ChatInitRequest, request: Request):
    """
    Initialize a chat session between two users with Diffie-Hellman key exchange

    Process:
    1. Verify current user from JWT token
    2. Find peer user by email
    3. Generate server-side DH keypair for the initiator
    4. Store chat session with both users' public keys
    5. Return chat_id and server's public key
    """
    # Verify the requesting user
    payload = verify_token_from_header(request)
    initiator_uid = payload.get("uid")
    initiator_email = payload.get("email")

    peer_email = body.peer_email.strip().lower()
    initiator_public_key = body.public_key

    # Cannot chat with yourself
    if peer_email == initiator_email:
        raise HTTPException(
            status_code=400, detail="Cannot start chat with yourself")

    # Find peer user
    users_ref = get_db_ref("/users")
    users_snapshot = users_ref.get() or {}

    peer_uid = None
    for uid, u in users_snapshot.items():
        if u.get("email") == peer_email:
            peer_uid = uid
            break

    if not peer_uid:
        raise HTTPException(
            status_code=404, detail="User with this email not found")

    # Check if chat already exists between these two users
    chats_ref = get_db_ref("/chats")
    chats_snapshot = chats_ref.get()

    # Handle case when no chats exist yet (empty database)
    if not chats_snapshot or not isinstance(chats_snapshot, dict):
        chats_snapshot = {}

    existing_chat_id = None
    if chats_snapshot:  # Only check if there are existing chats
        for chat_id, chat in chats_snapshot.items():
            # Skip if chat is not a dict (corrupted data)
            if not isinstance(chat, dict):
                continue
            participants = chat.get("participants", {})
            if not isinstance(participants, dict):
                continue
            if initiator_uid in participants and peer_uid in participants:
                existing_chat_id = chat_id
                break

    if existing_chat_id:
        # Chat already exists - return existing chat details
        existing_chat = chats_snapshot[existing_chat_id]
        return {
            "chat_id": existing_chat_id,
            "peer_uid": peer_uid,
            "peer_email": peer_email,
            "status": "existing",
            "aes_key": existing_chat.get("aes_key") if isinstance(existing_chat, dict) else None
        }

    # Create new chat session
    chat_ref = chats_ref.push()
    chat_id = chat_ref.key

    # For now, we store the initiator's public key
    # The peer will add their public key when they accept/open the chat
    # For this implementation, we'll generate a server-side keypair to complete the exchange

    # Generate server-side DH keypair (acting as peer temporarily)
    # Returns hex strings compatible with frontend
    server_private_key_hex, server_public_key_hex = generate_dh_keypair()

    # Compute shared secret and derive AES key
    # Now expects hex strings and returns bytes
    shared_secret_bytes = compute_shared_secret(
        server_private_key_hex, initiator_public_key)
    aes_key = derive_aes_key(shared_secret_bytes)

    # Store chat session in database
    chat_data = {
        "participants": {
            initiator_uid: {
                "email": initiator_email,
                "public_key": initiator_public_key,
                "joined_at": int(time.time())
            },
            peer_uid: {
                "email": peer_email,
                "public_key": server_public_key_hex,  # This will be replaced when peer joins
                "joined_at": None  # Will be set when peer joins
            }
        },
        # Derived session key (both parties will derive the same)
        "aes_key": aes_key,
        "created_at": int(time.time()),
        "created_by": initiator_uid,
        "status": "active"
    }

    chat_ref.set(chat_data)

    # Update user's active chats
    user_chat_ref = get_db_ref(f"/users/{initiator_uid}/chats/{chat_id}")
    user_chat_ref.set({
        "peer_uid": peer_uid,
        "peer_email": peer_email,
        "created_at": int(time.time())
    })

    peer_chat_ref = get_db_ref(f"/users/{peer_uid}/chats/{chat_id}")
    peer_chat_ref.set({
        "peer_uid": initiator_uid,
        "peer_email": initiator_email,
        "created_at": int(time.time())
    })

    return {
        "chat_id": chat_id,
        "peer_uid": peer_uid,
        "peer_email": peer_email,
        "server_public_key": server_public_key_hex,
        "aes_key": aes_key,
        "status": "created"
    }


@router.get("/chat/list")
async def list_chats(request: Request):
    """
    Get list of all chats for the current user with unread counts
    """
    payload = verify_token_from_header(request)
    user_uid = payload.get("uid")

    # Get user's chats
    user_chats_ref = get_db_ref(f"/users/{user_uid}/chats")
    user_chats = user_chats_ref.get() or {}

    chat_list = []
    for chat_id, chat_info in user_chats.items():
        unread_count = chat_info.get("unread_count", 0)
        chat_list.append({
            "chat_id": chat_id,
            "peer_email": chat_info.get("peer_email"),
            "peer_uid": chat_info.get("peer_uid"),
            "created_at": chat_info.get("created_at"),
            "unread_count": unread_count
        })

    return {"chats": chat_list}


@router.get("/chat/{chat_id}")
async def get_chat_details(chat_id: str, request: Request):
    """
    Get details of a specific chat including AES key
    """
    payload = verify_token_from_header(request)
    user_uid = payload.get("uid")

    # Get chat data
    chat_ref = get_db_ref(f"/chats/{chat_id}")
    chat_data = chat_ref.get()

    if not chat_data:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Verify user is participant
    participants = chat_data.get("participants", {})
    if user_uid not in participants:
        raise HTTPException(
            status_code=403, detail="You are not a participant in this chat")

    return {
        "chat_id": chat_id,
        "participants": participants,
        "aes_key": chat_data.get("aes_key"),
        "created_at": chat_data.get("created_at"),
        "status": chat_data.get("status")
    }
