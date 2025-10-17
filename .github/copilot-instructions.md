# Copilot Instructions for WooshChat

## Project Overview

WooshChat is a secure end-to-end encrypted chat application with a **React + Vite frontend** and **FastAPI backend**. The core security architecture uses **Diffie-Hellman key exchange** with **AES-256 encryption** for each chat session.

### Architecture

-   **Frontend**: React 19 with Vite, TailwindCSS 4, React Router v7
-   **Backend**: FastAPI with Firebase Realtime Database for storage
-   **Authentication**: JWT tokens (no expiry), Argon2 password hashing
-   **Encryption**: DH key exchange (RFC 3526 Group 14, 2048-bit) → HKDF-SHA256 → AES-256-CBC

## Critical Development Workflows

### Running the Application

**Backend** (port 8008):

```bash
cd backend
uvicorn main:app --reload --port 8008
```

**Frontend** (Vite dev server):

```bash
npm run dev
```

Both must run simultaneously. Backend expects `.env` file with `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_DB_URL`, and `JWT_SECRET`.

### Environment Setup

Backend requires `backend/firebase_service_account.json` and `backend/.env` with:

-   `FIREBASE_SERVICE_ACCOUNT=./firebase_service_account.json`
-   `FIREBASE_DB_URL=https://your-project.firebaseio.com`
-   `JWT_SECRET=your_secret_key`

Frontend uses `VITE_API_BASE` env var (defaults to `http://localhost:8008`).

## Project-Specific Patterns

### Crypto Module Synchronization

**Critical**: `src/utils/crypto.js` and `backend/crypto_utils.py` must remain synchronized. Both use:

-   Same DH parameters (P, G from RFC 3526)
-   Hex string representation for keys
-   Custom HKDF implementation (salt: `"woosh-chat-salt"`, info: `"aes-session-key"`)

**Example DH Flow**:

1. Frontend generates keypair in `RoutePage.jsx` → `generateDHKeypair()`
2. Sends public key to `/chat/init` endpoint
3. Backend computes shared secret in `chat.py` → `compute_shared_secret()`
4. Both derive identical AES key using `derive_aes_key()` / `deriveAESKey()`

### Authentication Flow

All protected routes use `verify_token_from_header()` from `backend/protected.py`:

```python
payload = verify_token_from_header(request)
uid = payload.get("uid")
```

Frontend stores JWT in `localStorage.getItem("token")` and sends as `Authorization: Bearer <token>`.

**Auth state management** in `App.jsx`: polls localStorage every 100ms to sync auth across components (handles same-tab logout).

### Firebase Data Structure

```
/users/{uid}
  ├─ email: string
  ├─ hashedPassword: string (Argon2)
  └─ chats/{chat_id}
       ├─ peer_uid: string
       ├─ peer_email: string
       └─ created_at: timestamp

/chats/{chat_id}
  ├─ participants/{uid}
  │    ├─ email, public_key, joined_at
  ├─ aes_key: base64 string (server derives this)
  ├─ created_by: uid
  └─ status: "active" | "pending"
```

**Key insight**: AES keys are stored in Firebase (server-side) and localStorage (client-side) for session recovery. Not ideal for production but enables multi-device access pattern.

### Chat Initialization Pattern

See `CHAT_INIT_IMPLEMENTATION.md` for full flow. Key points:

-   **Existing chat detection**: `/chat/init` checks if chat exists between users before creating
-   **Status responses**: `"existing"` (chat found) vs `"created"` (new chat)
-   **Private key storage**: Client stores DH private key in `sessionStorage` temporarily, not persisted
-   **AES key in localStorage**: `localStorage.setItem('chat_${chat_id}', JSON.stringify({...}))`

## Integration Points

### FastAPI Router Structure

`backend/main.py` includes routers:

```python
app.include_router(signup_router)    # /signup
app.include_router(login_router)     # /login
app.include_router(protected_router) # /protected
app.include_router(chat_router)      # /chat/init, /chat/list, /chat/{chat_id}
```

**CORS**: Configured for `allow_origins=["*"]` (development mode).

### Frontend API Calls

All API calls use `apiBase` prop (injected from `App.jsx`):

```javascript
const res = await fetch(`${apiBase}/chat/init`, {
    headers: { Authorization: `Bearer ${token}` },
});
```

**Error handling pattern**: Check `res.ok`, then handle 401/403 with logout redirect, other errors display without logout.

## Component Structure Conventions

### Pages Organization

-   `src/pages/Login.jsx`, `Signup.jsx`: Unprotected auth pages
-   `src/pages/RoutePage.jsx`: Main protected dashboard (requires JWT)
-   Protected route logic in `App.jsx` using `<Navigate>` redirects

### State Management Pattern

**No global state library**. Uses:

-   `localStorage` for JWT and chat metadata persistence
-   `sessionStorage` for temporary crypto keys
-   Component-level `useState` for UI state
-   `useEffect` with `fetch` for data fetching (no React Query)

### Styling Conventions

TailwindCSS 4 with Vite plugin. Classes used consistently:

-   Background: `bg-black`, `bg-gray-900`, `bg-gray-800`
-   Text: `text-white`, `text-gray-400`, `text-red-400`
-   Hover states: `hover:bg-gray-800`
-   Layout: Flexbox-first (`flex`, `flex-col`, `items-center`)

## Known Technical Decisions

1. **No TypeScript**: Pure JavaScript project despite React 19 support
2. **No message storage**: Messages not yet implemented (next phase per CHAT_INIT_IMPLEMENTATION.md)
3. **Server-side DH keypair**: Backend generates temporary keypair for initiator; should be replaced with actual peer key when peer joins
4. **JWT without expiry**: Tokens never expire (reload/logout to invalidate)
5. **AES keys in Firebase**: Stored server-side for multi-device access (trade-off vs pure E2EE)

## Testing Approach

Manual testing flow documented in `CHAT_INIT_IMPLEMENTATION.md`:

1. Create two accounts via `/signup`
2. Login with first user → redirected to `/`
3. Click "Start New Chat", enter second user's email
4. Check Firebase Realtime Database structure
5. Verify AES key consistency between server response and localStorage

No automated tests currently exist.

## File Reference

**Critical files** for understanding architecture:

-   `backend/crypto_utils.py` + `src/utils/crypto.js`: Crypto implementation must stay in sync
-   `backend/chat.py`: Core chat logic and DH key exchange
-   `src/pages/RoutePage.jsx`: Chat UI and client-side crypto integration
-   `backend/_firebase.py`: Firebase initialization pattern (singleton via `firebase_admin._apps` check)
