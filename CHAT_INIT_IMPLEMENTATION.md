# Chat Initialization Implementation Summary

## Overview

Implemented Diffie-Hellman key exchange for secure chat initialization with AES session key derivation.

## Backend Implementation

### 1. Cryptography Utilities (`backend/crypto_utils.py`)

-   **DH Key Generation**: Uses RFC 3526 MODP Group 14 (2048-bit prime)
-   **Functions**:
    -   `generate_dh_keypair()`: Generates DH private/public key pair
    -   `compute_shared_secret()`: Computes shared secret from private key and peer's public key
    -   `derive_aes_key()`: Derives 256-bit AES key using HKDF-SHA256

### 2. Chat API Endpoints (`backend/chat.py`)

#### POST `/chat/init`

**Purpose**: Initialize a chat session with Diffie-Hellman key exchange

**Process**:

1. Verify requesting user from JWT token
2. Find peer user by email in Firebase
3. Check if chat already exists between users
4. Generate server-side DH keypair
5. Compute shared secret using initiator's public key
6. Derive AES-256 session key from shared secret
7. Store chat session in Firebase with both users' info

**Request Body**:

```json
{
    "peer_email": "user@example.com",
    "public_key": "base64_encoded_dh_public_key"
}
```

**Response**:

```json
{
    "chat_id": "unique_chat_id",
    "peer_uid": "peer_user_id",
    "peer_email": "peer@example.com",
    "server_public_key": "base64_server_public_key",
    "aes_key": "base64_aes_session_key",
    "status": "created"
}
```

#### GET `/chat/list`

Returns all chats for authenticated user

#### GET `/chat/{chat_id}`

Returns details of specific chat including AES key

### 3. Database Structure (Firebase Realtime DB)

#### `/chats/{chat_id}`

```json
{
    "participants": {
        "user_id_1": {
            "email": "user1@example.com",
            "public_key": "dh_public_key_base64",
            "joined_at": 1697020800
        },
        "user_id_2": {
            "email": "user2@example.com",
            "public_key": "dh_public_key_base64",
            "joined_at": 1697020800
        }
    },
    "aes_key": "base64_aes_256_key",
    "created_at": 1697020800,
    "created_by": "user_id_1",
    "status": "pending"
}
```

#### `/users/{uid}/chats/{chat_id}`

```json
{
    "peer_uid": "other_user_id",
    "peer_email": "peer@example.com",
    "created_at": 1697020800,
    "pending": true
}
```

## Frontend Implementation

### 1. Crypto Utilities (`src/utils/crypto.js`)

-   **DH Implementation**: Uses same RFC 3526 parameters as backend
-   **Functions**:
    -   `generateDHKeypair()`: Generates DH keys using BigInt
    -   `computeSharedSecret()`: Computes shared secret
    -   `deriveAESKey()`: Derives AES key using HKDF with CryptoJS
    -   `encryptMessage()`: AES-256-CBC encryption
    -   `decryptMessage()`: AES-256-CBC decryption

### 2. Updated RoutePage Component

**Features Added**:

-   Chat initialization popup with email input
-   DH keypair generation on chat initialization
-   API call to `/chat/init` with user's public key
-   Stores chat info and AES key in localStorage
-   Shows loading state during initialization
-   Error handling and display

**Flow**:

1. User clicks "Start New Chat" button
2. Enters peer's email address
3. Frontend generates DH keypair
4. Sends public key to backend via `/chat/init`
5. Backend computes shared secret and derives AES key
6. Frontend stores chat details including AES key
7. Success message displayed with partial AES key

## Security Features

1. **Diffie-Hellman Key Exchange**:

    - 2048-bit MODP group (RFC 3526 Group 14)
    - Secure against passive eavesdropping
    - Each chat session has unique keys

2. **AES-256 Encryption**:

    - 256-bit key derived from shared secret
    - HKDF for key derivation
    - CBC mode with PKCS7 padding

3. **Key Storage**:
    - DH private keys stored in sessionStorage (temporary)
    - AES keys stored in localStorage per chat
    - User IDs from Firebase used as identifiers

## Files Modified/Created

### Backend:

-   ✅ `backend/crypto_utils.py` (new)
-   ✅ `backend/chat.py` (new)
-   ✅ `backend/main.py` (updated - added chat router)
-   ✅ `backend/requirements.txt` (updated - added cryptography)

### Frontend:

-   ✅ `src/utils/crypto.js` (new)
-   ✅ `src/pages/RoutePage.jsx` (updated - added chat init logic)
-   ✅ `package.json` (updated - added crypto-js)

## Next Steps (Not Implemented)

1. **Message Encryption**: Use derived AES key to encrypt/decrypt messages
2. **Real-time Messaging**: Implement WebSocket or Firebase listeners for messages
3. **Chat UI**: Create chat interface to display and send encrypted messages
4. **Peer Key Exchange**: When peer opens chat, replace server public key with actual peer key
5. **Key Rotation**: Implement periodic key rotation for long-lived chats
6. **Perfect Forward Secrecy**: Implement ratcheting for message-level keys

## Testing the Implementation

1. **Start Backend**:

    ```bash
    cd backend
    uvicorn main:app --reload --port 8008
    ```

2. **Start Frontend**:

    ```bash
    npm run dev
    ```

3. **Test Flow**:
    - Create two user accounts (signup)
    - Login with first user
    - Click "Start New Chat"
    - Enter second user's email
    - Check console/response for AES key
    - Check Firebase DB for chat entry under `/chats/`
    - Check both users have chat reference under `/users/{uid}/chats/`

## Database Verification

Check Firebase Realtime Database:

-   `/chats/{chat_id}` should contain participants, AES key, timestamps
-   `/users/{uid}/chats/{chat_id}` should show peer info for both users
-   AES keys should be consistent and base64 encoded
