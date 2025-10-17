// src/pages/ChatView.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { encryptMessage, decryptMessage } from "../utils/crypto";

export default function ChatView({ apiBase }) {
    const navigate = useNavigate();
    const { chatId } = useParams();
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState("");
    const [aesKey, setAesKey] = useState(null);
    const [peerEmail, setPeerEmail] = useState("");
    const [currentUid, setCurrentUid] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const messagesEndRef = useRef(null);
    const pollIntervalRef = useRef(null);

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    localStorage.removeItem("token");
                    navigate("/login");
                    return;
                }
                throw new Error("Failed to fetch messages");
            }

            const data = await res.json();

            // Store AES key if not already stored
            if (data.aes_key && !aesKey) {
                setAesKey(data.aes_key);
            }

            // Decrypt messages
            const decryptedMessages = data.messages.map((msg) => {
                try {
                    const decrypted = decryptMessage(
                        msg.encrypted_text,
                        data.aes_key
                    );
                    return {
                        ...msg,
                        text: decrypted,
                    };
                } catch (err) {
                    console.error("Decryption error:", err);
                    return {
                        ...msg,
                        text: "[Decryption failed]",
                    };
                }
            });

            setMessages(decryptedMessages);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching messages:", err);
            setError(err.message);
            setLoading(false);
        }
    }, [apiBase, chatId, navigate, aesKey]);

    const markAllAsRead = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            await fetch(`${apiBase}/chat/${chatId}/mark-all-read`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
        } catch (err) {
            console.error("Error marking messages as read:", err);
        }
    }, [apiBase, chatId]);

    // Load chat data and AES key
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        // Get stored chat info
        const chatInfoStr = localStorage.getItem(`chat_${chatId}`);
        if (chatInfoStr) {
            const chatInfo = JSON.parse(chatInfoStr);
            setAesKey(chatInfo.aes_key);
            setPeerEmail(chatInfo.peer_email);
        }

        // Fetch current user info to identify own messages
        fetch(`${apiBase}/protected`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then(() => {
                // Extract UID from JWT payload or use a dedicated endpoint
                const payload = JSON.parse(atob(token.split(".")[1]));
                setCurrentUid(payload.uid);
            })
            .catch((err) => console.error("Error fetching user info:", err));

        // Initial message fetch (will also mark as read)
        fetchMessages();

        // Poll for new messages every 2 seconds (will also mark as read)
        pollIntervalRef.current = setInterval(() => {
            fetchMessages();
        }, 2000);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, [chatId, apiBase, navigate, fetchMessages, markAllAsRead]);

    const sendMessage = async (e) => {
        e.preventDefault();

        if (!inputMessage.trim() || !aesKey) return;

        setSending(true);
        setError("");

        try {
            // Encrypt message on frontend
            const encrypted = encryptMessage(inputMessage, aesKey);

            const token = localStorage.getItem("token");
            const res = await fetch(`${apiBase}/chat/${chatId}/send`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    encrypted_message: encrypted,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to send message");
            }

            // Clear input and fetch messages
            setInputMessage("");
            fetchMessages();
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getTimeRemaining = (expiresAt) => {
        if (!expiresAt) return null;

        const now = Math.floor(Date.now() / 1000);
        const remaining = expiresAt - now;

        if (remaining <= 0) return "Expired";

        const seconds = remaining % 60;
        return `${seconds}s`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <p className="text-gray-400">Loading messages...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="bg-gray-900 p-4 flex items-center justify-between border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/")}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ← Back
                    </button>
                    <div>
                        <h1 className="text-lg font-medium">{peerEmail}</h1>
                        <p className="text-xs text-gray-400">
                            End-to-end encrypted
                        </p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-900 bg-opacity-30 p-3 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">
                        <p>No messages yet.</p>
                        <p className="text-sm mt-2">
                            Send a message to start the conversation!
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwnMessage = msg.sender_uid === currentUid;
                        const timeRemaining =
                            msg.status === "read"
                                ? getTimeRemaining(msg.expires_at)
                                : null;

                        return (
                            <div
                                key={msg.message_id}
                                className={`flex ${
                                    isOwnMessage
                                        ? "justify-end"
                                        : "justify-start"
                                }`}
                            >
                                <div
                                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                        isOwnMessage
                                            ? "bg-blue-600"
                                            : "bg-gray-800"
                                    }`}
                                >
                                    <p className="text-sm break-words">
                                        {msg.text}
                                    </p>
                                    <div className="flex items-center justify-between gap-2 mt-1">
                                        <p className="text-xs text-gray-300">
                                            {formatTime(msg.timestamp)}
                                        </p>
                                        {timeRemaining && (
                                            <p className="text-xs text-yellow-400 font-mono">
                                                🔥 {timeRemaining}
                                            </p>
                                        )}
                                        {msg.status === "unread" && (
                                            <span className="text-xs text-green-400">
                                                ●
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form
                onSubmit={sendMessage}
                className="bg-gray-900 p-4 border-t border-gray-800"
            >
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Type a message..."
                        disabled={sending}
                        className="flex-1 px-4 py-2 bg-black border border-gray-700 rounded focus:outline-none focus:border-gray-600 disabled:opacity-50 text-white"
                    />
                    <button
                        type="submit"
                        disabled={sending || !inputMessage.trim()}
                        className="px-6 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {sending ? "Sending..." : "Send"}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Messages disappear 1 minute after being read
                </p>
            </form>
        </div>
    );
}
