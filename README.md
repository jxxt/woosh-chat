# 🔥 WooshChat - Ephemeral Encrypted Messaging

A secure end-to-end encrypted chat application with **self-destructing messages** that disappear 60 seconds after being read.

## ✨ Features

### 🔐 Security

-   **End-to-end encryption** using AES-256-CBC
-   **Diffie-Hellman key exchange** (2048-bit, RFC 3526 Group 14)
-   **Unique session keys** per chat
-   **Client-side encryption** - messages encrypted before leaving your device
-   **JWT authentication** with Argon2 password hashing

### 🔥 Ephemeral Messaging

-   Messages **self-destruct** 60 seconds after being read
-   **Countdown timer** visible to both users (🔥 Xs)
-   **Automatic deletion** from database - no trace left
-   Chat persists, only messages disappear

### 🎯 Real-Time Features

-   **Green dot notifications** for new messages
-   **Unread count badges** on home page
-   **Live countdown timers** on messages
-   **Auto-refresh** polling for instant updates
-   Messages appear in **real-time** on both screens

### 💫 User Experience

-   Modern dark UI with TailwindCSS 4
-   Clean chat interface with message bubbles
-   Click any chat to start messaging
-   Smooth animations and transitions
-   Mobile-responsive design

## 🚀 Quick Start

### Prerequisites

-   Node.js 18+ and npm
-   Python 3.8+
-   Firebase project with Realtime Database

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/jxxt/woosh-chat.git
cd woosh-chat
```

2. **Install frontend dependencies**

```bash
npm install
```

3. **Install backend dependencies**

```bash
cd backend
pip install -r requirements.txt
```

4. **Configure Firebase**

-   Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
-   Download service account key and save as `backend/firebase_service_account.json`
-   Create `backend/.env` file:

```env
FIREBASE_SERVICE_ACCOUNT=./firebase_service_account.json
FIREBASE_DB_URL=https://your-project.firebaseio.com
JWT_SECRET=your_random_secret_key_here
```

### Running the Application

**Terminal 1 - Backend:**

```bash
cd backend
uvicorn main:app --reload --port 8008
```

**Terminal 2 - Frontend:**

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser!

## 📖 Usage

### First Time Setup

1. Click **"Signup"** to create an account
2. Enter email and password
3. Login with your credentials

### Starting a Chat

1. Click **"Start New Chat"** on home page
2. Enter peer's email address
3. Chat initializes with Diffie-Hellman key exchange
4. Click the chat to open and start messaging

### Sending Messages

1. Open a chat from your chat list
2. Type your message in the input field
3. Click **"Send"** or press Enter
4. Message is encrypted and sent
5. You see it in a blue bubble (right side)
6. Recipient sees it in gray bubble (left side)

### Receiving Messages

1. **Green pulsing dot** appears on chat with new messages
2. **Badge shows unread count** (e.g., "2")
3. Click chat to open and read messages
4. **Timer starts automatically**: 🔥 60s countdown
5. Watch message disappear after 60 seconds!

## 🏗️ Architecture

### Tech Stack

**Frontend:**

-   React 19 - UI framework
-   Vite 7 - Build tool
-   React Router v7 - Routing
-   TailwindCSS 4 - Styling
-   CryptoJS - Client-side encryption

**Backend:**

-   FastAPI - Python web framework
-   Firebase Realtime Database - Data storage
-   Cryptography - Server-side encryption
-   PyJWT - Authentication
-   Argon2 - Password hashing

### Encryption Flow

```
User A                          Backend                         User B
  |                                |                                |
  | 1. Generate DH keypair         |                                |
  | 2. Send public key             |                                |
  |---------------------------->   |                                |
  |                                | 3. Generate server keypair     |
  |                                | 4. Compute shared secret       |
  |                                | 5. Derive AES-256 key          |
  |   <----------------------------|                                |
  |    Return server public key    |                                |
  |                                |                                |
  | 6. Compute same shared secret  |                                |
  | 7. Derive same AES-256 key     |                                |
  |                                |                                |
  | 8. Encrypt message locally     |                                |
  | 9. Send encrypted message      |                                |
  |---------------------------->   |                                |
  |                                | 10. Store encrypted in DB      |
  |                                |   (status: "unread")           |
  |                                |                                |
  |                                |                                | 11. Fetch messages
  |                                |   <----------------------------|
  |                                | 12. Return encrypted messages  |
  |                                |   ---------------------------->|
  |                                |                                | 13. Decrypt with AES key
  |                                |                                | 14. Display message
  |                                |                                |
  |                                | 15. Mark as read               |
  |                                |   <----------------------------|
  |                                | 16. Start 60s timer            |
  |                                | 17. Auto-delete after 60s      |
```

## 📁 Project Structure

```
woosh-chat/
├── backend/
│   ├── main.py                 # FastAPI app & routes
│   ├── messages.py             # Message endpoints & auto-deletion
│   ├── chat.py                 # Chat initialization
│   ├── crypto_utils.py         # DH & AES encryption
│   ├── protected.py            # JWT authentication
│   ├── login.py                # Login endpoint
│   ├── signup.py               # Signup endpoint
│   └── requirements.txt        # Python dependencies
│
├── src/
│   ├── pages/
│   │   ├── ChatView.jsx        # Chat interface with timer
│   │   ├── RoutePage.jsx       # Home page with chat list
│   │   ├── Login.jsx           # Login page
│   │   └── Signup.jsx          # Signup page
│   ├── utils/
│   │   └── crypto.js           # Client-side encryption
│   ├── App.jsx                 # Routes & auth logic
│   └── main.jsx                # React entry point
│
├── EPHEMERAL_MESSAGING.md      # Technical documentation
├── TESTING_GUIDE.md            # Testing instructions
├── IMPLEMENTATION_SUMMARY.md   # Feature summary
└── package.json                # Node dependencies
```

## 🔒 Security Notes

### What's Secure

✅ Messages encrypted before leaving client device  
✅ AES-256-CBC with unique IVs per message  
✅ 2048-bit Diffie-Hellman key exchange  
✅ Argon2 password hashing  
✅ JWT authentication  
✅ Automatic message deletion

### Production Considerations

⚠️ AES keys stored in Firebase (server has access)  
⚠️ No key rotation implemented  
⚠️ Replace polling with WebSocket for production  
⚠️ Add rate limiting to prevent spam  
⚠️ Implement perfect forward secrecy (Double Ratchet)

## 📚 Documentation

-   **[EPHEMERAL_MESSAGING.md](./EPHEMERAL_MESSAGING.md)** - Complete technical documentation
-   **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Step-by-step testing instructions
-   **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Quick reference guide

## 🧪 Testing

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed testing instructions.

**Quick test:**

1. Open two browser windows (one normal, one incognito)
2. Create two accounts: `usera@test.com` and `userb@test.com`
3. User A starts chat with User B
4. User A sends message
5. User B sees green dot notification
6. User B opens chat - timer starts
7. Watch message disappear after 60 seconds!

## 🎯 API Endpoints

### Authentication

-   `POST /signup` - Create new account
-   `POST /login` - Login and get JWT
-   `GET /protected` - Verify JWT (protected route)

### Chat Management

-   `POST /chat/init` - Initialize chat with DH key exchange
-   `GET /chat/list` - Get all chats with unread counts
-   `GET /chat/{chat_id}` - Get chat details

### Messaging

-   `POST /chat/{chat_id}/send` - Send encrypted message
-   `GET /chat/{chat_id}/messages` - Get all messages in chat
-   `POST /chat/{chat_id}/mark-all-read` - Mark messages as read (starts timer)

## 🛠️ Development

### Backend Development

```bash
cd backend
uvicorn main:app --reload --port 8008
```

### Frontend Development

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm run preview
```

## 🤝 Contributing

This is a student project for CNS (Computer Network Security) course. Feel free to fork and experiment!

## 📄 License

This project is for educational purposes.

## 🙏 Acknowledgments

-   Built as a CNS (Computer Network Security) project
-   Implements cryptographic concepts from RFC 3526
-   Uses industry-standard encryption libraries

---

**"Messages that matter, then disappear."** 🔥

Made with ❤️ for secure communication
