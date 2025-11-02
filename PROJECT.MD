# WooshChat - Project Documentation

## Executive Summary

WooshChat is a secure, ephemeral end-to-end encrypted chat application built with a React frontend and FastAPI backend. The application implements Diffie-Hellman key exchange for secure session establishment and AES-256-CBC encryption for message confidentiality. Messages automatically expire 60 seconds after being read, providing ephemeral messaging capabilities.

---

## Technology Stack

### Frontend

-   **Framework**: React 19.1.1
-   **Build Tool**: Vite 7.1.2
-   **Routing**: React Router v7 (react-router-dom 7.8.2)
-   **Styling**: TailwindCSS 4.1.13 with Vite plugin
-   **Cryptography**: CryptoJS 4.2.0
-   **Language**: JavaScript (ES6+)

### Backend

-   **Framework**: FastAPI (Python)
-   **Server**: Uvicorn with standard extras
-   **Database**: Firebase Realtime Database
-   **Authentication**: JWT (PyJWT) with no expiration
-   **Password Hashing**: Argon2 (argon2-cffi)
-   **Cryptography**: Python cryptography library
-   **Validation**: Pydantic with email-validator
-   **Environment**: python-dotenv

### Development Environment

-   **Port Configuration**:
    -   Backend: 8008 (Uvicorn)
    -   Frontend: Vite dev server (default 5173)
-   **CORS**: Fully open (`allow_origins=["*"]`) for development

---

## Architecture Overview

### System Design

```
┌─────────────┐          ┌──────────────┐          ┌─────────────┐
│   Browser   │◄────────►│  FastAPI     │◄────────►│  Firebase   │
│  (React)    │  HTTPS   │  Backend     │  Admin   │  Realtime   │
│             │          │  (Port 8008) │   SDK    │  Database   │
└─────────────┘          └──────────────┘          └─────────────┘
      │                         │
      │                         │
  LocalStorage            JWT + Argon2
  SessionStorage          Authentication
```

### Frontend Structure

```
src/
├── App.jsx                    # Route protection & auth state management
├── main.jsx                   # React DOM entry point
├── index.css                  # Global styles
├── pages/
│   ├── Login.jsx             # User authentication page
│   ├── Signup.jsx            # User registration page
│   ├── RoutePage.jsx         # Main dashboard (chat list)
│   └── ChatView.jsx          # Individual chat interface
└── utils/
    └── crypto.js             # Client-side cryptographic functions
```

### Backend Structure

```
backend/
├── main.py                    # FastAPI app initialization & CORS
├── _firebase.py              # Firebase singleton initialization
├── signup.py                 # User registration endpoints
├── login.py                  # Authentication endpoints
├── protected.py              # JWT verification utilities
├── chat.py                   # Chat session management
├── messages.py               # Message CRUD & expiration
├── crypto_utils.py           # Server-side crypto functions
├── requirements.txt          # Python dependencies
└── .env                      # Environment configuration
```

---

## Cryptographic Architecture

### Diffie-Hellman Key Exchange

**Parameters** (RFC 3526 Group 14):

-   **Prime (P)**: 2048-bit MODP group
-   **Generator (G)**: 2
-   **Private Key Size**: 256 bits (random)
-   **Public Key**: `G^private_key mod P`

**Implementation Synchronization**:
Both `crypto_utils.py` and `crypto.js` use identical parameters and hex string representation for interoperability.

**Key Exchange Flow**:

```
Client (Initiator)              Server                  Peer
      │                           │                       │
      ├─ Generate DH keypair      │                       │
      │  (privateKey, publicKey)  │                       │
      │                           │                       │
      ├─ POST /chat/init ────────►│                       │
      │  {peer_email, publicKey}  │                       │
      │                           │                       │
      │                           ├─ Generate server      │
      │                           │  keypair (temp)       │
      │                           │                       │
      │                           ├─ Compute shared       │
      │                           │  secret               │
      │                           │                       │
      │◄─ Response ───────────────┤                       │
      │  {server_public_key,      │                       │
      │   aes_key, chat_id}       │                       │
      │                           │                       │
      ├─ Compute shared secret    │                       │
      │  from server_public_key   │                       │
      │                           │                       │
      ├─ Derive AES key (HKDF)    │                       │
      └─ Store in localStorage    │                       │
```

### AES Key Derivation (Custom HKDF)

**Parameters**:

-   **Algorithm**: HMAC-SHA256
-   **Salt**: `"woosh-chat-salt"` (UTF-8 bytes)
-   **Info**: `"aes-session-key"` (UTF-8 bytes)
-   **Output Length**: 256 bits (32 bytes)

**Derivation Process**:

```python
# Step 1: Extract
PRK = HMAC-SHA256(salt, shared_secret)

# Step 2: Expand
OKM = HMAC-SHA256(PRK, info || 0x01)
AES_KEY = Base64(OKM)  # 256-bit key
```

**Critical Implementation Detail**: Both frontend (JavaScript) and backend (Python) must derive the identical AES key from the same shared secret. The custom HKDF implementation ensures compatibility.

### Message Encryption (AES-256-CBC)

**Algorithm**: AES-256 in CBC mode with PKCS7 padding

**Encryption Process**:

```javascript
// Generate random 16-byte IV
IV = Random(16 bytes)

// Encrypt message
Ciphertext = AES-256-CBC(Plaintext, AES_KEY, IV)

// Combine and encode
Encrypted = Base64(IV || Ciphertext)
```

**Decryption Process**:

```javascript
// Decode and split
Combined = Base64_Decode(Encrypted)
IV = Combined[0:16]
Ciphertext = Combined[16:]

// Decrypt
Plaintext = AES-256-CBC-Decrypt(Ciphertext, AES_KEY, IV)
```

**Security Properties**:

-   **Unique IV per message**: Prevents pattern analysis
-   **PKCS7 padding**: Ensures block alignment
-   **256-bit key**: Strong cryptographic strength
-   **CBC mode**: Industry-standard block cipher mode

---

## Authentication System

### User Registration Flow

**Endpoint**: `POST /signup`

**Process**:

1. Validate email format (Pydantic EmailStr)
2. Check password length (minimum 6 characters)
3. Query Firebase for existing email
4. Hash password with Argon2 (default parameters)
5. Create user record in `/users/{uid}`
6. Return `{success: true, uid: <generated_uid>}`

**Firebase Schema**:

```json
{
    "/users/{uid}": {
        "email": "user@example.com",
        "hashedPassword": "$argon2id$v=19$m=...",
        "chats": {
            "{chat_id}": {
                "peer_uid": "...",
                "peer_email": "...",
                "created_at": 1234567890,
                "unread_count": 0
            }
        }
    }
}
```

### Login Flow

**Endpoint**: `POST /login`

**Process**:

1. Normalize email (strip, lowercase)
2. Find user in Firebase by email
3. Verify password with Argon2 (`ph.verify()`)
4. Generate JWT with payload: `{uid, email}`
5. Return `{token: <jwt_token>}`

**JWT Configuration**:

-   **Algorithm**: HS256
-   **Secret**: Environment variable `JWT_SECRET`
-   **Expiration**: None (token valid indefinitely)
-   **Claims**: `uid`, `email`

### Protected Routes

**Verification Function**: `verify_token_from_header(request)`

**Implementation**:

```python
# Extract Bearer token from Authorization header
Authorization: Bearer <token>

# Decode and verify JWT
payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

# Return payload for uid/email extraction
return payload
```

**Frontend Storage**:

-   Token stored in `localStorage.getItem("token")`
-   Auth state polling: 100ms interval in `App.jsx`
-   Automatic redirect on 401/403 responses

---

## API Endpoints

### Authentication

| Method | Endpoint     | Auth | Description           |
| ------ | ------------ | ---- | --------------------- |
| POST   | `/signup`    | None | Register new user     |
| POST   | `/login`     | None | Authenticate user     |
| GET    | `/protected` | JWT  | Verify token validity |

### Chat Management

| Method | Endpoint          | Auth | Description                              |
| ------ | ----------------- | ---- | ---------------------------------------- |
| POST   | `/chat/init`      | JWT  | Initialize new chat or retrieve existing |
| GET    | `/chat/list`      | JWT  | Get all user chats with unread counts    |
| GET    | `/chat/{chat_id}` | JWT  | Get chat details including AES key       |

### Messaging

| Method | Endpoint                        | Auth | Description                         |
| ------ | ------------------------------- | ---- | ----------------------------------- |
| POST   | `/chat/{chat_id}/send`          | JWT  | Send encrypted message              |
| GET    | `/chat/{chat_id}/messages`      | JWT  | Fetch all messages (auto-decrypted) |
| POST   | `/chat/{chat_id}/mark-read`     | JWT  | Mark single message as read         |
| POST   | `/chat/{chat_id}/mark-all-read` | JWT  | Mark all unread messages as read    |

---

## Detailed API Flows

### Chat Initialization (`POST /chat/init`)

**Request**:

```json
{
    "peer_email": "peer@example.com",
    "public_key": "<hex_dh_public_key>"
}
```

**Process**:

1. **Verify Initiator**: Extract `uid` and `email` from JWT
2. **Validate Peer**: Cannot chat with self
3. **Find Peer User**: Query Firebase `/users` for matching email
4. **Check Existing Chat**:
    - Iterate through `/chats` to find participants match
    - If found, return existing chat with `status: "existing"`
5. **Create New Chat**:
    - Generate server-side DH keypair (temporary)
    - Compute shared secret: `peer_public^server_private mod P`
    - Derive AES key via custom HKDF
    - Store chat in `/chats/{chat_id}`
    - Update both users' `/users/{uid}/chats/{chat_id}`

**Response (New Chat)**:

```json
{
    "chat_id": "firebase_push_key",
    "peer_uid": "...",
    "peer_email": "peer@example.com",
    "server_public_key": "<hex_key>",
    "aes_key": "<base64_key>",
    "status": "created"
}
```

**Response (Existing Chat)**:

```json
{
    "chat_id": "existing_chat_id",
    "peer_uid": "...",
    "peer_email": "peer@example.com",
    "aes_key": "<base64_key>",
    "status": "existing"
}
```

**Firebase Schema Created**:

```json
{
    "/chats/{chat_id}": {
        "participants": {
            "{initiator_uid}": {
                "email": "...",
                "public_key": "<initiator_public_hex>",
                "joined_at": 1234567890
            },
            "{peer_uid}": {
                "email": "...",
                "public_key": "<server_public_hex>",
                "joined_at": null
            }
        },
        "aes_key": "<base64_derived_key>",
        "created_at": 1234567890,
        "created_by": "{initiator_uid}",
        "status": "active"
    }
}
```

### Message Sending (`POST /chat/{chat_id}/send`)

**Request**:

```json
{
    "encrypted_message": "<base64_iv_ciphertext>"
}
```

**Process**:

1. **Verify Participant**: Ensure sender is in chat participants
2. **Store Encrypted Message**: Save as-is (no server-side decryption)
3. **Generate Message ID**: Firebase push key
4. **Update Unread Counts**: Increment for all participants except sender
5. **Return Confirmation**: Include `message_id` and `timestamp`

**Message Schema**:

```json
{
    "/chats/{chat_id}/messages/{message_id}": {
        "message_id": "...",
        "sender_uid": "...",
        "encrypted_text": "<base64>",
        "timestamp": 1234567890,
        "status": "unread",
        "read_at": null,
        "expires_at": null
    }
}
```

### Message Retrieval (`GET /chat/{chat_id}/messages`)

**Response**:

```json
{
    "messages": [
        {
            "message_id": "...",
            "sender_uid": "...",
            "encrypted_text": "<base64>",
            "timestamp": 1234567890,
            "status": "read",
            "read_at": 1234567890,
            "expires_at": 1234567950
        }
    ],
    "aes_key": "<base64_aes_key>"
}
```

**Process**:

1. **Verify Participant**: Check user is in chat
2. **Fetch Messages**: Query `/chats/{chat_id}/messages`
3. **Filter Expired**: Skip messages where `current_time >= expires_at`
4. **Sort by Timestamp**: Chronological order
5. **Include AES Key**: For client-side decryption

**Frontend Decryption**:

```javascript
messages.map((msg) => ({
    ...msg,
    text: decryptMessage(msg.encrypted_text, aesKey),
}));
```

### Mark Messages as Read (`POST /chat/{chat_id}/mark-all-read`)

**Process**:

1. **Fetch All Messages**: Query chat messages
2. **Filter Unread**: Only messages with `status: "unread"` and not sent by user
3. **Update Messages**:
    - Set `status: "read"`
    - Set `read_at: current_timestamp`
    - Set `expires_at: current_timestamp + 60`
4. **Reset Unread Count**: Set `/users/{uid}/chats/{chat_id}/unread_count` to 0

**Response**:

```json
{
    "marked_count": 5,
    "expires_at": 1234567950
}
```

---

## Ephemeral Messaging System

### Message Lifecycle

```
1. Created (status: "unread")
   ├─ encrypted_text: stored
   ├─ expires_at: null
   └─ read_at: null

2. Read (status: "read")
   ├─ read_at: timestamp
   └─ expires_at: read_at + 60 seconds

3. Expired (deleted)
   └─ Removed from Firebase
```

### Background Cleanup Task

**Implementation** (`messages.py:cleanup_expired_messages`):

```python
async def cleanup_expired_messages():
    while True:
        current_time = int(time.time())

        # Iterate all chats and messages
        for chat_id, chat in chats_data.items():
            for msg_id, msg in chat.messages.items():
                expires_at = msg.get("expires_at")

                # Delete if expired
                if expires_at and current_time >= expires_at:
                    message_ref.delete()

        await asyncio.sleep(10)  # Check every 10 seconds
```

**Startup Integration** (`main.py`):

```python
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(cleanup_expired_messages())
```

### Frontend Countdown Display

**Real-time Calculation** (`ChatView.jsx`):

```javascript
const getTimeRemaining = (expiresAt) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = expiresAt - now;

    if (remaining <= 0) return "Expired";

    const seconds = remaining % 60;
    return `${seconds}s`;
};
```

**Display**: Shows "🔥 {seconds}s" for read messages with active timers.

---

## Frontend State Management

### Authentication State

**Polling Mechanism** (`App.jsx`):

```javascript
useEffect(() => {
    const handleStorageChange = () => {
        setAuth(!!localStorage.getItem("token"));
    };

    // Check every 100ms for localStorage changes
    const interval = setInterval(handleStorageChange, 100);

    // Also listen for storage events (cross-tab)
    window.addEventListener("storage", handleStorageChange);

    return () => {
        clearInterval(interval);
        window.removeEventListener("storage", handleStorageChange);
    };
}, []);
```

**Rationale**: Enables same-tab logout synchronization without complex state libraries.

### Message Polling

**Implementation** (`ChatView.jsx`):

```javascript
// Poll every 2 seconds
const pollIntervalRef = useRef(null);

useEffect(() => {
    fetchMessages(); // Initial fetch

    pollIntervalRef.current = setInterval(() => {
        fetchMessages();
    }, 2000);

    return () => clearInterval(pollIntervalRef.current);
}, [chatId]);
```

**Auto-mark as Read**: Each poll triggers `mark-all-read` endpoint before fetching messages.

### Chat List Updates

**Implementation** (`RoutePage.jsx`):

```javascript
// Poll every 3 seconds for unread counts
useEffect(() => {
    const fetchData = async () => {
        // Fetch protected route + chat list
        const chatsRes = await fetch(`${apiBase}/chat/list`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        setChats(chatsData.chats || []);
    };

    fetchData();
    const pollInterval = setInterval(fetchData, 3000);

    return () => clearInterval(pollInterval);
}, [apiBase]);
```

### LocalStorage Data Schema

**JWT Token**:

```javascript
localStorage.setItem("token", "<jwt_token>");
```

**Chat Metadata**:

```javascript
localStorage.setItem(
    `chat_${chat_id}`,
    JSON.stringify({
        chat_id: "...",
        peer_email: "peer@example.com",
        peer_uid: "...",
        aes_key: "<base64_key>",
        client_aes_key: "<base64_key>", // For verification
    })
);
```

**SessionStorage** (Temporary DH Keys):

```javascript
sessionStorage.setItem("dh_private_key", "<hex_private_key>");
```

---

## Database Schema (Firebase Realtime Database)

### Complete Structure

```json
{
    "users": {
        "{uid}": {
            "email": "user@example.com",
            "hashedPassword": "$argon2id$v=19$m=65536$...",
            "chats": {
                "{chat_id}": {
                    "peer_uid": "{other_user_uid}",
                    "peer_email": "peer@example.com",
                    "created_at": 1234567890,
                    "unread_count": 3
                }
            }
        }
    },

    "chats": {
        "{chat_id}": {
            "participants": {
                "{uid_1}": {
                    "email": "user1@example.com",
                    "public_key": "a1b2c3...",
                    "joined_at": 1234567890
                },
                "{uid_2}": {
                    "email": "user2@example.com",
                    "public_key": "d4e5f6...",
                    "joined_at": 1234567895
                }
            },
            "aes_key": "base64_encoded_key",
            "created_at": 1234567890,
            "created_by": "{uid_1}",
            "status": "active",
            "messages": {
                "{message_id}": {
                    "message_id": "msg_123",
                    "sender_uid": "{uid_1}",
                    "encrypted_text": "base64_iv_ciphertext",
                    "timestamp": 1234567900,
                    "status": "read",
                    "read_at": 1234567910,
                    "expires_at": 1234567970
                }
            }
        }
    }
}
```

### Data Access Patterns

**User Lookup by Email**:

```python
users_ref = get_db_ref("/users")
users_snapshot = users_ref.get() or {}

for uid, user_data in users_snapshot.items():
    if user_data.get("email") == target_email:
        found_uid = uid
        break
```

**Chat Participant Verification**:

```python
chat_ref = get_db_ref(f"/chats/{chat_id}")
chat_data = chat_ref.get()
participants = chat_data.get("participants", {})

if user_uid not in participants:
    raise HTTPException(403, "Not a participant")
```

**Unread Count Management**:

```python
# Increment on send
unread_ref = get_db_ref(f"/users/{peer_uid}/chats/{chat_id}/unread_count")
current_unread = unread_ref.get() or 0
unread_ref.set(current_unread + 1)

# Reset on mark-all-read
unread_ref.set(0)

# Decrement on single message read
new_unread = max(0, current_unread - 1)
unread_ref.set(new_unread)
```

---

## UI/UX Design

### TailwindCSS Theme

**Color Palette**:

-   **Background**: `bg-black`, `bg-gray-900`, `bg-gray-800`
-   **Text**: `text-white`, `text-gray-400`, `text-gray-300`
-   **Accents**:
    -   Primary: `bg-gradient-to-br from-purple-500 to-blue-500`
    -   Success: `text-green-400`, `bg-green-500`
    -   Error: `text-red-400`, `bg-red-900`
    -   Warning: `text-yellow-400`

**Layout Patterns**:

-   Flexbox-first: `flex flex-col items-center justify-center`
-   Rounded corners: `rounded-2xl`, `rounded-xl`
-   Shadows: `shadow-lg`
-   Transitions: `transition-colors duration-200`

### Component Design

**Chat List Item**:

```jsx
<div
    className="bg-gradient-to-br from-gray-800 to-gray-900 
                p-5 rounded-2xl hover:from-gray-700 
                hover:to-gray-800 transition-colors cursor-pointer"
>
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
                className="w-12 h-12 bg-gradient-to-br 
                            from-purple-500 to-blue-500 
                            rounded-full flex items-center 
                            justify-center text-white font-bold"
            >
                {email.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div>
                <p className="font-semibold text-lg">{email}</p>
                <p className="text-sm text-gray-400">Tap to open</p>
            </div>
        </div>

        {/* Unread Badge */}
        {unread_count > 0 && (
            <div className="flex items-center gap-2">
                <span
                    className="w-3 h-3 bg-green-500 
                               rounded-full animate-pulse"
                ></span>
                <span
                    className="bg-green-500 text-white 
                               px-3 py-1.5 rounded-full"
                >
                    {unread_count}
                </span>
            </div>
        )}
    </div>
</div>
```

**Message Bubble**:

```jsx
<div
    className={`max-w-xs px-4 py-2 rounded-lg 
                ${isOwnMessage ? "bg-blue-600" : "bg-gray-800"}`}
>
    <p className="text-sm break-words">{messageText}</p>
    <div className="flex items-center justify-between gap-2 mt-1">
        <p className="text-xs text-gray-300">{formatTime(timestamp)}</p>
        {timeRemaining && (
            <p className="text-xs text-yellow-400 font-mono">
                🔥 {timeRemaining}
            </p>
        )}
    </div>
</div>
```

### Responsive Design

**Mobile-First Approach**:

-   Max width containers: `max-w-2xl mx-auto`
-   Full-height layouts: `min-h-screen flex flex-col`
-   Scrollable sections: `flex-1 overflow-y-auto`
-   Fixed input areas: Bottom-pinned with `position-relative` parent

---

## Security Considerations

### Strengths

1. **End-to-End Encryption**: Messages encrypted client-side before transmission
2. **Strong Key Derivation**: 2048-bit DH with SHA-256 HKDF
3. **Password Security**: Argon2 hashing with default parameters
4. **Unique Message IVs**: Prevents ciphertext pattern analysis
5. **Ephemeral Messages**: Automatic deletion after read + 60s
6. **No Password Transmission**: Hashed before storage, verified server-side

### Limitations & Trade-offs

1. **AES Keys in Firebase**: Server stores derived keys (enables multi-device but reduces E2EE purity)
2. **AES Keys in LocalStorage**: Client stores keys unencrypted (browser compromise risk)
3. **JWT Without Expiry**: Tokens valid indefinitely until manual logout
4. **Server-Side DH Keypair**: Backend generates temporary peer keys (not true peer-to-peer)
5. **Open CORS Policy**: `allow_origins=["*"]` (development mode only)
6. **No Perfect Forward Secrecy**: Same AES key reused for entire chat session
7. **No Message Authentication**: No HMAC/signature verification (integrity not guaranteed)

### Recommended Production Enhancements

1. **Implement True Peer DH Exchange**: Actual peer generates their own keys
2. **Remove Server-Side Key Storage**: Full E2EE without Firebase key persistence
3. **Add JWT Expiration**: Short-lived tokens with refresh mechanism
4. **Implement Message Authentication**: HMAC or authenticated encryption (GCM)
5. **Add Perfect Forward Secrecy**: Ratchet mechanism (e.g., Double Ratchet)
6. **Secure Key Storage**: Use Web Crypto API `non-extractable` keys
7. **Rate Limiting**: Prevent brute-force on authentication endpoints
8. **CORS Restrictions**: Whitelist specific frontend origins

---

## Environment Configuration

### Backend `.env` File

```bash
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT=./firebase_service_account.json
FIREBASE_DB_URL=https://your-project.firebaseio.com

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=your_super_secret_random_key_here
```

### Frontend Environment Variables

```bash
# API Base URL (default: http://localhost:8008)
VITE_API_BASE=http://localhost:8008
```

**Usage in Code**:

```javascript
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8008";
```

### Firebase Service Account

**File**: `backend/firebase_service_account.json`

**Structure**:

```json
{
    "type": "service_account",
    "project_id": "your-project-id",
    "private_key_id": "...",
    "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com",
    "client_id": "...",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "..."
}
```

---

## Running the Application

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with Firebase credentials

# Start server (development mode)
uvicorn main:app --reload --port 8008
```

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

**Access**: Navigate to `http://localhost:5173` (Vite default port)

### Production Build

```bash
# Build frontend
npm run build

# Serve with static file server
npm run preview
```

---

## Testing Workflow

### Manual Testing Flow

1. **Create Account A**: `/signup` with `userA@example.com`
2. **Create Account B**: `/signup` with `userB@example.com`
3. **Login as User A**: Redirected to `/`
4. **Initialize Chat**: Enter `userB@example.com`, click "Start"
5. **Verify Firebase**:
    - Check `/chats/{chat_id}/participants` has both users
    - Verify `aes_key` exists
6. **Verify LocalStorage**:
    - `localStorage.getItem('chat_{chat_id}')` contains AES key
7. **Login as User B**: See chat in list (from User A)
8. **Send Message**: Type and send from User A
9. **Verify Encryption**:
    - Firebase shows `encrypted_text` as Base64 gibberish
    - User B receives decrypted plaintext
10. **Test Expiration**:
    - User B opens chat (marks messages as read)
    - Wait 60 seconds
    - Verify message deleted from Firebase

### Browser DevTools Checks

**LocalStorage Inspection**:

```javascript
// View stored token
localStorage.getItem("token");

// View chat metadata
JSON.parse(localStorage.getItem("chat_<chat_id>"));
```

**Network Tab**:

-   Verify `Authorization: Bearer <token>` header on all protected routes
-   Check POST `/chat/{chat_id}/send` payload contains `encrypted_message`

**Firebase Console**:

-   Realtime Database → Data tab
-   Verify structure matches schema
-   Observe message deletion after 60s countdown

---

## Known Issues & Future Enhancements

### Current Limitations

1. **No Typing Indicators**: Cannot see when peer is typing
2. **No Read Receipts**: Only local status tracking
3. **No Message Deletion**: Cannot manually delete messages
4. **No File Attachments**: Text-only messaging
5. **No Group Chats**: Only 1-on-1 conversations
6. **No Push Notifications**: Polling-based updates only
7. **No Offline Support**: Requires active internet connection
8. **No Message Search**: Cannot search chat history

### Planned Features

-   **WebSocket Integration**: Replace polling with real-time updates
-   **Push Notifications**: Browser notifications for new messages
-   **Message Reactions**: Emoji reactions to messages
-   **Voice Messages**: Audio recording and playback
-   **Media Sharing**: Image/video encryption and transmission
-   **Profile Customization**: Avatars, display names
-   **Multi-Device Sync**: Seamless session across devices
-   **Backup & Export**: Encrypted chat backup

### Performance Optimizations

-   **Pagination**: Load messages in chunks (currently loads all)
-   **Virtual Scrolling**: Render only visible messages
-   **Message Caching**: Client-side message cache
-   **Debounced Polling**: Reduce polling frequency when inactive
-   **Lazy Loading**: Code-split routes and components

---

## Deployment Considerations

### Backend Deployment

**Recommended Platforms**:

-   **Railway**: Simple Python app deployment
-   **Render**: Free tier with automatic HTTPS
-   **Fly.io**: Edge deployment with global distribution
-   **AWS Lambda + API Gateway**: Serverless FastAPI

**Configuration**:

```bash
# Procfile (for Railway/Render)
web: uvicorn main:app --host 0.0.0.0 --port $PORT

# Runtime
runtime.txt: python-3.11
```

### Frontend Deployment

**Recommended Platforms**:

-   **Vercel**: Automatic Vite deployment
-   **Netlify**: CDN-powered hosting
-   **Cloudflare Pages**: Edge network deployment
-   **Firebase Hosting**: Integration with Firebase backend

**Build Configuration**:

```json
{
    "scripts": {
        "build": "vite build",
        "preview": "vite preview"
    }
}
```

### Environment Variables (Production)

```bash
# Backend
FIREBASE_SERVICE_ACCOUNT=<base64_encoded_json>
FIREBASE_DB_URL=https://prod-db.firebaseio.com
JWT_SECRET=<32_byte_hex_random>

# Frontend
VITE_API_BASE=https://api.wooshchat.com
```

---

## Code Synchronization Requirements

### Critical File Pairs

**Crypto Implementation** (`crypto_utils.py` ↔ `crypto.js`):

-   **DH Parameters**: P and G must be identical
-   **Key Derivation**: HKDF salt/info must match
-   **Hex Encoding**: Both use hex strings for key representation
-   **AES Mode**: Both use CBC with PKCS7 padding

**Validation Checklist**:

```python
# Python side
P = int("FFFFFFFFFFFFFFFFC90FDAA2...", 16)
G = 2
salt = b"woosh-chat-salt"
info = b"aes-session-key"

# JavaScript side
const P_HEX = "FFFFFFFFFFFFFFFFC90FDAA2...";
const G = 2;
const salt = "woosh-chat-salt";
const info = "aes-session-key";
```

**Breaking Changes Risk**:

-   Changing salt/info breaks key derivation compatibility
-   Modifying P/G invalidates DH exchange
-   Altering AES mode/padding prevents decryption

---

## Glossary

-   **DH (Diffie-Hellman)**: Key exchange protocol for establishing shared secrets
-   **HKDF (HMAC-based Key Derivation Function)**: Method to derive cryptographic keys
-   **AES (Advanced Encryption Standard)**: Symmetric encryption algorithm
-   **CBC (Cipher Block Chaining)**: Block cipher mode of operation
-   **JWT (JSON Web Token)**: Stateless authentication token format
-   **Argon2**: Memory-hard password hashing function
-   **PKCS7**: Padding scheme for block ciphers
-   **IV (Initialization Vector)**: Random value for encryption uniqueness
-   **E2EE (End-to-End Encryption)**: Encryption that protects data from sender to receiver
-   **MODP (Modular Exponentiation Groups)**: Standardized DH parameters (RFC 3526)

---

## File Manifest

| File                      | Purpose                | Lines | Key Functions                                                 |
| ------------------------- | ---------------------- | ----- | ------------------------------------------------------------- |
| `backend/main.py`         | FastAPI app & CORS     | ~40   | `startup_event()`                                             |
| `backend/_firebase.py`    | Firebase singleton     | ~20   | `init_firebase()`, `get_db_ref()`                             |
| `backend/signup.py`       | User registration      | ~35   | `POST /signup`                                                |
| `backend/login.py`        | Authentication         | ~40   | `POST /login`                                                 |
| `backend/protected.py`    | JWT verification       | ~25   | `verify_token_from_header()`                                  |
| `backend/chat.py`         | Chat management        | ~190  | `POST /chat/init`, `GET /chat/list`                           |
| `backend/messages.py`     | Messaging & expiration | ~280  | `POST /send`, `GET /messages`, `cleanup_expired_messages()`   |
| `backend/crypto_utils.py` | Server-side crypto     | ~80   | `generate_dh_keypair()`, `derive_aes_key()`                   |
| `src/App.jsx`             | Route protection       | ~80   | Auth state management                                         |
| `src/pages/Login.jsx`     | Login UI               | ~100  | Login form                                                    |
| `src/pages/Signup.jsx`    | Registration UI        | ~100  | Signup form                                                   |
| `src/pages/RoutePage.jsx` | Chat list dashboard    | ~250  | Chat initialization, list display                             |
| `src/pages/ChatView.jsx`  | Chat interface         | ~350  | Message send/receive, polling                                 |
| `src/utils/crypto.js`     | Client-side crypto     | ~150  | `generateDHKeypair()`, `encryptMessage()`, `decryptMessage()` |

**Total Backend**: ~670 lines of Python  
**Total Frontend**: ~1030 lines of JavaScript/JSX  
**Total Project**: ~1700 lines of application code

---

## Version History

-   **v0.1** (Initial): Basic auth + chat initialization
-   **v0.2** (Current): Messaging + ephemeral expiration + unread counts

---

## License & Disclaimer

This is an educational project demonstrating E2EE concepts. **Not recommended for production use** without implementing suggested security enhancements. Use at your own risk.

---

**Generated**: November 2, 2025  
**Project**: WooshChat  
**Repository**: jxxt/woosh-chat
