# Quick Testing Guide - Ephemeral Messaging

## Start the Application

### Terminal 1 - Backend

```bash
cd backend
uvicorn main:app --reload --port 8008
```

### Terminal 2 - Frontend

```bash
npm run dev
```

## Test Scenario: Two Users Chatting

### Setup (One-time)

1. **Create User A**

    - Open browser (normal mode): http://localhost:5173
    - Click "Signup"
    - Email: `usera@test.com`
    - Password: `password123`
    - Click "Signup"

2. **Create User B**
    - Open browser (incognito mode): http://localhost:5173
    - Click "Signup"
    - Email: `userb@test.com`
    - Password: `password123`
    - Click "Signup"

### Test Flow

#### User A Initiates Chat & Sends Message

1. **Normal browser** (User A logged in)
2. Click **"Start New Chat"**
3. Enter email: `userb@test.com`
4. Click **"OK"**
5. Chat appears in list - **Click on it**
6. ChatView opens
7. Type message: `"This is a secret message!"`
8. Click **"Send"**
9. Message appears in blue bubble on right side
10. Status shows green dot (●) = unread

#### User B Sees Notification

1. **Incognito browser** (User B logged in)
2. On home page, you'll see User A's chat
3. **Wait 3 seconds** (polling interval)
4. **Green pulsing dot** appears next to chat
5. **Badge shows "1"** unread message

#### User B Opens Chat - Timer Starts!

1. **Click on User A's chat**
2. ChatView opens
3. Message displays: `"This is a secret message!"`
4. **Timer starts immediately**: 🔥 60s → 59s → 58s...
5. Gray bubble (left side = received message)

#### Watch Both Screens

1. **User A's screen**: Also shows timer counting down
2. **User B's screen**: Timer counting down
3. Both see the same countdown

#### Message Disappears (After 60 seconds)

1. Wait for timer to reach 0
2. Within 10 seconds (cleanup task runs every 10s)
3. **Message disappears from BOTH screens**
4. **Chat still exists** but message is gone
5. Can verify in Firebase: message completely deleted

### What to Look For

✅ **Encryption**: Check Firebase - `encrypted_text` field should be gibberish
✅ **Green dot**: Appears on home page when new message arrives
✅ **Unread badge**: Shows count of unread messages
✅ **Timer display**: Shows countdown `🔥 Xs`
✅ **Auto-deletion**: Message vanishes after 60 seconds
✅ **Real-time updates**: Both users see timer simultaneously (2-3 second delay from polling)

### Firebase Verification

Open Firebase Realtime Database console:

**Before User B opens chat:**

```
/chats/{chat_id}/messages/{msg_id}
  - status: "unread"
  - read_at: null
  - expires_at: null
```

**After User B opens chat:**

```
/chats/{chat_id}/messages/{msg_id}
  - status: "read"
  - read_at: 1697020860
  - expires_at: 1697020920  (read_at + 60)
```

**After 60+ seconds:**

```
/chats/{chat_id}/messages/{msg_id}
  - [DELETED - no longer exists]
```

### Edge Cases to Test

1. **Multiple messages**: Send 3-4 messages, all should have separate timers
2. **Close and reopen**: Timer should persist even if you close ChatView
3. **Sender sees timer too**: User A also sees countdown on their own messages
4. **Logout/login**: Messages should still expire even if users log out

### Troubleshooting

**Green dot not appearing?**

-   Wait 3 seconds (polling interval)
-   Check backend is running
-   Check console for errors

**Timer not counting down?**

-   Check ChatView is polling (every 2 seconds)
-   Verify message has `expires_at` field in Firebase

**Message not disappearing?**

-   Check backend terminal for cleanup task logs
-   Should see: "Deleted expired message {msg_id} from chat {chat_id}"
-   Cleanup runs every 10 seconds

**Can't send message?**

-   Check if chat was initialized properly
-   Verify AES key exists in localStorage: `chat_{chat_id}`
-   Check browser console for encryption errors

### Expected Console Output

**Backend startup:**

```
INFO:     Application startup complete.
```

**When message expires (every 10 seconds):**

```
Deleted expired message -NgXt7... from chat -NgXt5...
```

**Frontend (browser console):**

-   No errors should appear
-   Can see polling requests in Network tab
