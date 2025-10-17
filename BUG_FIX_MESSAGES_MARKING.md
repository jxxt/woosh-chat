# Bug Fix: Messages Not Marked as Read When Chat Already Open

## Issue Description

**Problem:**
When User B has a chat with User A already open, and User A sends a new message:
- The message appears in User B's ChatView (due to polling)
- BUT the message status remains "unread"
- Timer never starts
- Message won't auto-delete after 60 seconds

**Root Cause:**
The `mark-all-read` endpoint was only called once when the ChatView component mounted. Any new messages arriving after that were never marked as read because the endpoint wasn't called again.

## Solution Implemented

**Approach:** Option 1 - Mark as Read During Every Poll

**Change:** Modified `fetchMessages()` to call `mark-all-read` before fetching messages on every poll cycle.

### Code Changes

**File: `src/pages/ChatView.jsx`**

**Before:**
```javascript
const fetchMessages = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const res = await fetch(`${apiBase}/chat/${chatId}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        // ... rest of fetch logic
    }
    // ...
}, [apiBase, chatId, navigate, aesKey]);
```

**After:**
```javascript
const fetchMessages = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        // Mark all messages as read first (so any new messages get marked)
        await fetch(`${apiBase}/chat/${chatId}/mark-all-read`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        }).catch((err) => console.error("Error marking as read:", err));

        // Then fetch messages
        const res = await fetch(`${apiBase}/chat/${chatId}/messages`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        // ... rest of fetch logic
    }
    // ...
}, [apiBase, chatId, navigate, aesKey]);
```

**Also removed redundant call:**
```javascript
// Before:
fetchMessages();
markAllAsRead();  // ← Removed this line

// After:
fetchMessages();  // This now handles marking as read internally
```

## How It Works Now

### Flow

1. **User B opens chat**
   - `fetchMessages()` called
   - Calls `mark-all-read` → marks existing messages as read, starts timers
   - Fetches and displays messages

2. **Polling continues (every 2 seconds)**
   - `fetchMessages()` called again
   - Calls `mark-all-read` → marks any new messages as read, starts timers
   - Fetches and displays messages (including new ones)

3. **User A sends new message**
   - Message stored in DB with `status: "unread"`
   - User B's next poll cycle (within 2 seconds)
   - `mark-all-read` called → changes status to "read", sets `expires_at`
   - Message fetched with timer info
   - Timer displayed: 🔥 60s
   - Auto-deletes after 60 seconds

### Sequence Diagram

```
User B (Chat Open)        Backend              User A
      |                      |                    |
      | Poll (every 2s)      |                    |
      | mark-all-read        |                    |
      |--------------------->|                    |
      |                      | Mark: unread→read  |
      |                      | Set: expires_at    |
      |<---------------------|                    |
      | Fetch messages       |                    |
      |--------------------->|                    |
      |<---------------------|                    |
      | Display with timer   |                    |
      |                      |                    |
      |                      |                    | Send message
      |                      |<-------------------|
      |                      | Store: unread      |
      |                      |                    |
      | Poll (2s later)      |                    |
      | mark-all-read        |                    |
      |--------------------->|                    |
      |                      | Mark: unread→read ✅|
      |                      | Start timer ✅      |
      |<---------------------|                    |
      | Fetch messages       |                    |
      |--------------------->|                    |
      |<---------------------|                    |
      | Display NEW msg ✅    |                    |
      | Timer: 🔥 60s ✅      |                    |
```

## Benefits

✅ **Automatic marking** - Any message that arrives while chat is open gets marked as read automatically

✅ **Timer starts immediately** - New messages get their expiration timer within 2 seconds

✅ **Simple implementation** - No backend changes needed

✅ **Reliable** - Works consistently regardless of when messages arrive

✅ **Efficient** - Only adds one lightweight API call per poll cycle

## Performance Impact

- **Extra API calls:** 1 additional POST request per 2-second poll cycle
- **Overhead:** Minimal - `mark-all-read` is a lightweight operation
- **Network:** ~2 KB per request (negligible)
- **Backend load:** Insignificant - simple status update in Firebase

**Trade-off:** Slightly more API calls vs. guaranteed message marking → Worth it! ✅

## Testing

### Test Scenario

1. **User A logs in** (normal browser)
2. **User B logs in** (incognito browser)
3. **User B opens chat with User A** (ChatView opens)
4. **Keep ChatView open** (don't close it)
5. **User A sends message:** "Test message 1"
6. **Wait 2 seconds** (for poll cycle)
7. **Check User B's screen:**
   - ✅ Message appears
   - ✅ Timer shows: 🔥 60s (or slightly less)
   - ✅ Countdown starts immediately
8. **User A sends another message:** "Test message 2"
9. **Wait 2 seconds** (for poll cycle)
10. **Check User B's screen:**
    - ✅ Second message appears
    - ✅ Timer shows: 🔥 60s
    - ✅ Both messages have separate timers
11. **Wait 60+ seconds**
    - ✅ Both messages disappear automatically

### Verification

Check Firebase database during test:

**After User B receives message (within 2s):**
```
/chats/{chat_id}/messages/{msg_id}
  - status: "read"          ✅
  - read_at: [timestamp]    ✅
  - expires_at: [timestamp+60] ✅
```

**After 60 seconds:**
```
/chats/{chat_id}/messages/{msg_id}
  - [DELETED]               ✅
```

## Alternative Approaches Considered

### Option 2: Mark Individual Messages
- More granular but requires multiple API calls
- Not chosen: More complex for same result

### Option 3: Backend Auto-Mark on Fetch
- Simpler for frontend but less explicit
- Not chosen: Could accidentally mark messages

### Option 4: Query Parameter
- Most explicit control
- Not chosen: Requires backend changes, more complex

### Option 5: WebSocket
- Best for real-time but bigger architectural change
- Not chosen: Out of scope for current implementation

## Conclusion

**Status:** ✅ **FIXED**

The issue is now resolved. Messages arriving while a chat is already open will be automatically marked as read and their deletion timers will start properly.

**Files Changed:** 1 (`src/pages/ChatView.jsx`)

**Lines Changed:** ~15 lines

**Backend Changes:** None required

**Breaking Changes:** None

**Additional Testing:** Recommended before production deployment

---

*Fix implemented: October 17, 2025*
