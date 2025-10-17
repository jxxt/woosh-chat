# Ephemeral Messaging Implementation

## Overview

Implemented a complete ephemeral (self-destructing) messaging system with end-to-end encryption. Messages are encrypted using AES-256-CBC, stored in Firebase, and automatically deleted 1 minute after being read.

## Key Features

### 1. Message Encryption

-   **Client-side encryption**: Messages encrypted on sender's device before transmission
-   **AES-256-CBC**: Using session keys derived from Diffie-Hellman key exchange
-   **Random IV**: Each message uses a unique 16-byte initialization vector

### 2. Ephemeral Message Flow

#### Sending a Message (User A)

1. User A types message in ChatView
2. Message encrypted with AES-256 using chat's session key
3. Encrypted message sent to backend via POST `/chat/{chat_id}/send`
4. Backend stores with status: `"unread"`
5. Recipient's unread count incremented in `/users/{uid}/chats/{chat_id}/unread_count`

#### Receiving a Message (User B)

1. User B sees green dot indicator on home page (RoutePage polls every 3 seconds)
2. User B clicks chat to open ChatView
3. ChatView calls POST `/chat/{chat_id}/mark-all-read`
4. Backend updates all unread messages:
    - `status: "unread"` → `"read"`
    - `read_at: current_timestamp`
    - `expires_at: current_timestamp + 60` (1 minute timer starts)
5. Messages decrypted and displayed with countdown timer (🔥 Xs)
6. ChatView polls every 2 seconds to fetch updated messages

#### Message Deletion

1. Background task runs every 10 seconds (`cleanup_expired_messages()`)
2. Checks all messages for `expires_at <= current_time`
3. Deletes expired messages from Firebase: `/chats/{chat_id}/messages/{msg_id}`
4. Frontend polling detects missing messages and removes from UI

### 3. User Experience

**Home Page (RoutePage)**

-   Shows all chats with peer emails
-   Green pulsing dot + badge for chats with unread messages
-   Click chat to open ChatView

**Chat View (ChatView)**

-   Real-time message updates (polls every 2 seconds)
-   Own messages: Blue bubbles on right
-   Peer messages: Gray bubbles on left
-   Unread messages: Green dot indicator
-   Read messages: Countdown timer showing seconds remaining (🔥 Xs)
-   Messages disappear automatically when timer expires

## File Structure

### Backend Files

#### `backend/messages.py` (NEW)

Core messaging logic:

-   `POST /chat/{chat_id}/send`: Send encrypted message
-   `GET /chat/{chat_id}/messages`: Retrieve messages and decrypt
-   `POST /chat/{chat_id}/mark-read`: Mark single message as read
-   `POST /chat/{chat_id}/mark-all-read`: Mark all messages as read (called when opening chat)
-   `cleanup_expired_messages()`: Background task for auto-deletion

#### `backend/chat.py` (UPDATED)

-   Updated `/chat/list` endpoint to include `unread_count` for each chat

#### `backend/main.py` (UPDATED)

-   Added `messages_router` import and registration
-   Added `@app.on_event("startup")` to start background cleanup task

### Frontend Files

#### `src/pages/ChatView.jsx` (NEW)

Complete chat interface:

-   Message list with auto-scroll
-   Input field and send button
-   Real-time polling for new messages
-   Timer display for expiring messages
-   Auto-mark messages as read on open

#### `src/pages/RoutePage.jsx` (UPDATED)

-   Added click handler to navigate to `/chat/{chat_id}`
-   Display green dot and unread count badge
-   Poll every 3 seconds for unread updates

#### `src/utils/crypto.js` (UPDATED)

-   Updated `encryptMessage()`: Generates random IV, prepends to ciphertext
-   Updated `decryptMessage()`: Extracts IV from ciphertext
-   Compatible with backend's Python cryptography library

#### `src/App.jsx` (UPDATED)

-   Added `/chat/:chatId` route for ChatView component

## Database Schema

### `/chats/{chat_id}/messages/{message_id}`

```json
{
  "message_id": "unique_id",
  "sender_uid": "user_id",
  "encrypted_text": "base64_encrypted_message",
  "timestamp": 1697020800,
  "status": "unread" | "read",
  "read_at": 1697020860 | null,
  "expires_at": 1697020920 | null
}
```

### `/users/{uid}/chats/{chat_id}`

```json
{
    "peer_uid": "other_user_id",
    "peer_email": "peer@example.com",
    "created_at": 1697020800,
    "unread_count": 5
}
```

## API Endpoints

### Message Endpoints

#### `POST /chat/{chat_id}/send`

**Request:**

```json
{
    "encrypted_message": "base64_encoded_encrypted_text"
}
```

**Response:**

```json
{
    "message_id": "msg_123",
    "status": "sent",
    "timestamp": 1697020800
}
```

#### `GET /chat/{chat_id}/messages`

**Response:**

```json
{
    "messages": [
        {
            "message_id": "msg_123",
            "sender_uid": "user_123",
            "encrypted_text": "base64_encrypted",
            "timestamp": 1697020800,
            "status": "read",
            "read_at": 1697020860,
            "expires_at": 1697020920
        }
    ],
    "aes_key": "base64_aes_key"
}
```

#### `POST /chat/{chat_id}/mark-all-read`

**Response:**

```json
{
    "marked_count": 3,
    "expires_at": 1697020920
}
```

#### `GET /chat/list` (UPDATED)

**Response:**

```json
{
    "chats": [
        {
            "chat_id": "chat_123",
            "peer_email": "user@example.com",
            "peer_uid": "user_123",
            "created_at": 1697020800,
            "unread_count": 2
        }
    ]
}
```

## Security Considerations

### What's Secure

✅ End-to-end encryption: Messages encrypted on client before transmission
✅ AES-256-CBC: Industry standard encryption
✅ Unique IVs: Each message uses random IV (prevents pattern analysis)
✅ Ephemeral: Messages auto-delete after reading
✅ Session keys: Derived from DH key exchange per chat

### What's Not Production-Ready

⚠️ **AES keys stored in Firebase**: Server has access to decrypt messages

-   For true E2EE, keys should never touch server
-   Consider client-side key derivation only

⚠️ **No key rotation**: Same session key used for entire chat lifetime

-   Implement ratcheting (Signal Protocol style)

⚠️ **localStorage for keys**: Vulnerable to XSS attacks

-   Consider using IndexedDB with encryption or secure enclaves

⚠️ **Background deletion runs server-side**: Server can see when messages expire

-   For paranoid security, client should handle deletion confirmation

⚠️ **No message authentication**: Only encryption, no HMAC

-   Add authenticated encryption (AES-GCM or encrypt-then-MAC)

## Testing the Implementation

### Prerequisites

1. Two user accounts created via `/signup`
2. Backend running on port 8008
3. Frontend running on Vite dev server

### Test Flow

#### Step 1: User A sends message

```bash
# User A logs in and navigates to home page
# Clicks "Start New Chat"
# Enters User B's email
# Chat initializes with DH key exchange
```

#### Step 2: User A sends encrypted message

```bash
# User A clicks chat to open ChatView
# Types message: "Hello, this is a secret!"
# Message encrypted with AES-256
# Sent to backend, stored with status: "unread"
# User A sees message in blue bubble on right
```

#### Step 3: User B sees notification

```bash
# User B refreshes home page or waits for poll
# Green pulsing dot appears next to User A's chat
# Badge shows "1" unread message
```

#### Step 4: User B opens chat and timer starts

```bash
# User B clicks chat to open ChatView
# Backend marks message as read immediately
# read_at = current_time
# expires_at = current_time + 60 seconds
# User B sees decrypted message with timer: "🔥 60s"
```

#### Step 5: Watch countdown

```bash
# Timer counts down: 60s → 59s → 58s → ...
# Both User A and User B see the countdown
# (ChatView polls every 2 seconds for updates)
```

#### Step 6: Message disappears

```bash
# After 60 seconds, backend cleanup task deletes message
# Next poll cycle: message not returned in response
# Frontend removes message from UI
# Chat still exists, but message is gone from everywhere
```

### Verification Points

1. **Encryption Check**:

    ```bash
    # Check Firebase Realtime Database
    # Navigate to /chats/{chat_id}/messages/{msg_id}
    # encrypted_text should be base64 gibberish, not readable
    ```

2. **Status Transition**:

    ```bash
    # Before User B opens: status = "unread"
    # After User B opens: status = "read"
    # Check read_at and expires_at timestamps
    ```

3. **Deletion Confirmation**:

    ```bash
    # After 60 seconds, check Firebase
    # Message should be completely removed
    # No trace in database
    ```

4. **Unread Count**:
    ```bash
    # Check /users/{user_b_uid}/chats/{chat_id}/unread_count
    # Before opening: should be 1 (or more)
    # After opening: should be 0
    ```

## Performance Notes

-   **Frontend polling**: ChatView polls every 2 seconds (can increase for production)
-   **Home page polling**: RoutePage polls every 3 seconds for unread counts
-   **Cleanup task**: Runs every 10 seconds on backend
-   **Firebase queries**: Each poll = 1 read operation (optimize with Firebase listeners)

## Future Enhancements

1. **WebSocket/Firebase Realtime Listeners**: Replace polling with real-time updates
2. **Push Notifications**: Notify users of new messages even when app closed
3. **Typing Indicators**: Show when peer is typing
4. **Read Receipts**: More granular status (sent → delivered → read)
5. **Message Reactions**: Emoji reactions that also expire
6. **Media Messages**: Send encrypted images/videos (also ephemeral)
7. **Configurable Timer**: Let users choose expiration time (5s, 1min, 5min, etc.)
8. **Screenshot Detection**: Warn users about screenshots (mobile only)
9. **Perfect Forward Secrecy**: Implement Double Ratchet Algorithm
10. **Offline Support**: Queue messages when offline, send when reconnected

## Commands to Start

### Backend

```bash
cd backend
uvicorn main:app --reload --port 8008
```

### Frontend

```bash
npm run dev
```

## Troubleshooting

### Messages not decrypting

-   Check AES key consistency between sender and receiver
-   Verify IV is properly extracted from ciphertext
-   Console should show decryption errors

### Messages not disappearing

-   Check backend logs for cleanup task errors
-   Verify expires_at timestamp is set correctly
-   Ensure background task is running (check startup logs)

### Unread count not updating

-   Check RoutePage polling is active
-   Verify `/chat/list` endpoint returns unread_count
-   Check Firebase structure for unread_count field

### Timer not counting down

-   Check ChatView polling interval (2 seconds)
-   Verify expires_at field exists in message
-   Check getTimeRemaining() calculation logic
