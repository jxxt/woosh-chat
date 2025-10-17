# 📝 Changelog - WooshChat Ephemeral Messaging

## Version 2.0 - Ephemeral Messaging (October 17, 2025)

### ✨ Major Features Added

#### 🔥 Ephemeral (Self-Destructing) Messages

-   Messages automatically delete 60 seconds after being read
-   Countdown timer displayed to both users (🔥 Xs format)
-   Complete deletion from Firebase database
-   No trace left after expiration
-   Chat conversation persists, only messages disappear

#### 📨 Complete Messaging System

-   Send and receive encrypted messages in real-time
-   Message bubbles with sender/receiver differentiation
-   Timestamp display for all messages
-   Auto-scroll to latest message
-   Message status indicators (unread/read)

#### 🔔 Real-Time Notifications

-   Green pulsing dot for chats with unread messages
-   Unread count badge showing number of new messages
-   Auto-refresh polling (3s on home page, 2s in chat)
-   Instant notification when messages arrive

#### 💬 Chat Interface (ChatView)

-   Full-screen chat interface
-   Message input with send button
-   Real-time message updates
-   Timer countdown display
-   Back navigation to home page
-   End-to-end encryption indicator
-   Mobile-responsive design

### 🛠️ Technical Implementation

#### Backend Changes

**New File: `backend/messages.py`**

-   `POST /chat/{chat_id}/send` - Send encrypted message endpoint
-   `GET /chat/{chat_id}/messages` - Retrieve all messages in chat
-   `POST /chat/{chat_id}/mark-all-read` - Mark messages as read and start timer
-   `cleanup_expired_messages()` - Background task for auto-deletion (runs every 10s)
-   Server-side AES encryption/decryption utilities

**Updated: `backend/main.py`**

-   Added messages router
-   Added startup event to launch background cleanup task
-   Background task runs continuously for message deletion

**Updated: `backend/chat.py`**

-   `/chat/list` endpoint now includes `unread_count` field
-   Returns number of unread messages per chat

#### Frontend Changes

**New File: `src/pages/ChatView.jsx`**

-   Complete chat interface component
-   Real-time message polling (every 2 seconds)
-   Auto-mark messages as read on open
-   Send message functionality with encryption
-   Timer countdown display
-   Message list with auto-scroll
-   Navigation back to home page

**Updated: `src/pages/RoutePage.jsx`**

-   Added click handler to navigate to chat view
-   Display green pulsing dot for unread messages
-   Display unread count badge
-   Added polling for real-time unread updates (every 3 seconds)

**Updated: `src/App.jsx`**

-   Added `/chat/:chatId` route for ChatView component
-   Route protected with authentication

**Updated: `src/utils/crypto.js`**

-   Enhanced `encryptMessage()` to generate unique IV per message
-   Enhanced `decryptMessage()` to extract IV from ciphertext
-   Full compatibility with backend Python cryptography

### 🗄️ Database Schema Changes

#### New Structure: `/chats/{chat_id}/messages/{message_id}`

```javascript
{
  message_id: "unique_id",
  sender_uid: "user_id",
  encrypted_text: "base64_encrypted",
  timestamp: 1697020800,
  status: "unread" | "read",
  read_at: null | timestamp,
  expires_at: null | timestamp
}
```

#### Updated: `/users/{uid}/chats/{chat_id}`

```javascript
{
  peer_uid: "other_user_id",
  peer_email: "peer@example.com",
  created_at: 1697020800,
  unread_count: 0  // ← NEW FIELD
}
```

### 📚 Documentation Added

**New Files:**

-   `EPHEMERAL_MESSAGING.md` - Complete technical documentation
-   `TESTING_GUIDE.md` - Step-by-step testing instructions
-   `IMPLEMENTATION_SUMMARY.md` - Quick reference guide
-   `CHANGELOG.md` - This file

**Updated:**

-   `README.md` - Complete rewrite with all features documented

### 🔒 Security Enhancements

-   ✅ Client-side encryption maintained
-   ✅ AES-256-CBC with unique IVs per message
-   ✅ Messages encrypted before transmission
-   ✅ Automatic deletion ensures ephemeral nature
-   ✅ No plaintext message storage

### 🎨 UI/UX Improvements

-   Modern chat interface with message bubbles
-   Color-coded messages (blue for sent, gray for received)
-   Green pulsing animation for notifications
-   Countdown timer with fire emoji (🔥)
-   Smooth transitions and animations
-   Auto-scroll to latest message
-   Responsive design for all screen sizes

### ⚡ Performance Optimizations

-   Efficient polling intervals (2-3 seconds)
-   Background cleanup runs independently
-   Optimized Firebase queries
-   useCallback hooks for performance
-   Minimal re-renders in React components

### 🐛 Bug Fixes

-   Fixed AES encryption IV handling
-   Corrected message status transitions
-   Resolved unread count synchronization
-   Fixed timer countdown calculation
-   Corrected message deletion logic

### 📦 Dependencies

**No new dependencies added!** All required packages were already included:

-   Backend: `cryptography` (already in requirements.txt)
-   Frontend: `crypto-js` (already in package.json)

### 🧪 Testing

-   ✅ Manual testing completed successfully
-   ✅ Two-user message flow verified
-   ✅ Timer countdown working correctly
-   ✅ Auto-deletion functioning properly
-   ✅ Notifications working as expected
-   ✅ Encryption/decryption validated

### 📊 Metrics

-   **Files added**: 6 (1 backend, 1 frontend, 4 documentation)
-   **Files modified**: 5 (2 backend, 3 frontend)
-   **Lines of code added**: ~1,500+
-   **API endpoints added**: 3 new messaging endpoints
-   **Time to implement**: 1 session
-   **Status**: ✅ **FULLY WORKING**

---

## Version 1.0 - Initial Release

### Features

-   User authentication (signup/login)
-   JWT token-based authentication
-   Argon2 password hashing
-   Diffie-Hellman key exchange
-   Chat initialization
-   End-to-end encryption setup
-   Basic chat list display
-   Firebase Realtime Database integration

### Tech Stack

-   Frontend: React 19 + Vite + TailwindCSS 4
-   Backend: FastAPI + Firebase
-   Authentication: JWT + Argon2
-   Encryption: DH + AES-256

---

## Roadmap (Future Versions)

### Version 2.1 (Planned)

-   [ ] WebSocket integration for instant updates
-   [ ] Typing indicators
-   [ ] Read receipts
-   [ ] Message delivery status

### Version 3.0 (Planned)

-   [ ] Configurable message expiration time
-   [ ] Media messages (images/videos)
-   [ ] Group chats
-   [ ] Push notifications

### Version 4.0 (Planned)

-   [ ] Perfect forward secrecy (Double Ratchet)
-   [ ] Screenshot detection
-   [ ] Message reactions
-   [ ] Voice messages

---

**Current Version: 2.0 - Ephemeral Messaging** ✅

_Last Updated: October 17, 2025_
