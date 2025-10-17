// src/pages/RoutePage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    generateDHKeypair,
    deriveAESKey,
    computeSharedSecret,
} from "../utils/crypto";

export default function RoutePage({ apiBase }) {
    const navigate = useNavigate();
    const [message, setMessage] = useState("Loading...");
    const [err, setErr] = useState("");
    const [chatEmail, setChatEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [initError, setInitError] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [chats, setChats] = useState([]);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        const fetchData = async () => {
            try {
                // Fetch user info
                const res = await fetch(`${apiBase}/protected`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    setMessage(
                        data.message ||
                            "You have access to this protected route."
                    );
                    // Extract email from message or set it directly if available
                    const emailMatch = data.message?.match(/Hello (.+?),/);
                    if (emailMatch) {
                        setUserEmail(emailMatch[1]);
                    }
                } else if (res.status === 401 || res.status === 403) {
                    // If unauthorized, clear token and redirect to login
                    setErr(data.detail || data.error || "Unauthorized");
                    localStorage.removeItem("token");
                    setTimeout(() => navigate("/login"), 800);
                    return;
                } else {
                    // For other errors (e.g., backend down), show error but do not logout
                    setErr(
                        data.detail || data.error || `Error ${res.status || ""}`
                    );
                }

                // Fetch chats list
                const chatsRes = await fetch(`${apiBase}/chat/list`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (chatsRes.ok) {
                    const chatsData = await chatsRes.json();
                    setChats(chatsData.chats || []);
                }
            } catch (error) {
                // Network or unexpected error: show message but keep token
                setErr(error?.message || "Network error");
            }
        };

        // Initial fetch
        fetchData();

        // Poll every 3 seconds for unread updates
        const pollInterval = setInterval(fetchData, 3000);

        return () => clearInterval(pollInterval);
    }, [apiBase, navigate]);

    const logout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    const handleInitChat = async () => {
        if (!chatEmail.trim()) {
            setInitError("Please enter an email address");
            return;
        }

        setLoading(true);
        setInitError("");

        try {
            // Generate DH keypair
            const { privateKey, publicKey } = generateDHKeypair();

            // Store private key temporarily (in real app, handle this securely)
            sessionStorage.setItem("dh_private_key", privateKey);

            // Call backend to initialize chat
            const token = localStorage.getItem("token");
            const res = await fetch(`${apiBase}/chat/init`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    peer_email: chatEmail,
                    public_key: publicKey,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || "Failed to initialize chat");
            }

            let clientAESKey = null;

            // Check if this is an existing chat or a new chat
            if (data.status === "existing") {
                // For existing chats, just use the stored AES key
                clientAESKey = data.aes_key;
            } else {
                // For new chats, compute shared secret and derive AES key
                const serverPublicKey = data.server_public_key;
                const sharedSecret = computeSharedSecret(
                    privateKey,
                    serverPublicKey
                );
                clientAESKey = deriveAESKey(sharedSecret);
            }

            // Store chat info
            localStorage.setItem(
                `chat_${data.chat_id}`,
                JSON.stringify({
                    chat_id: data.chat_id,
                    peer_email: data.peer_email,
                    peer_uid: data.peer_uid,
                    aes_key: data.aes_key, // Use server-provided key
                    client_aes_key: clientAESKey, // For verification
                })
            );

            // Clear input and show success
            setChatEmail("");
            const statusMsg =
                data.status === "existing"
                    ? "Chat already exists"
                    : "Chat initialized";
            setMessage(
                `${statusMsg} with ${
                    data.peer_email
                }! AES Key: ${data.aes_key.substring(0, 20)}...`
            );

            // Refresh chats list
            const refreshToken = localStorage.getItem("token");
            const chatsRes = await fetch(`${apiBase}/chat/list`, {
                headers: { Authorization: `Bearer ${refreshToken}` },
            });
            if (chatsRes.ok) {
                const chatsData = await chatsRes.json();
                setChats(chatsData.chats || []);
            }
        } catch (error) {
            setInitError(error.message || "Failed to initialize chat");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <div className="w-full max-w-2xl mx-auto p-6 flex flex-col h-screen">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl">
                        {userEmail ? `Welcome ${userEmail}` : "Welcome"}
                    </h1>
                    <button
                        onClick={logout}
                        className="px-3 py-1 bg-gray-900 rounded cursor-pointer hover:bg-gray-800 transition-colors"
                    >
                        Logout
                    </button>
                </div>

                {err && <div className="text-red-400 mb-4">{err}</div>}

                {message && message !== "Loading..." && (
                    <div className="bg-green-900 bg-opacity-30 p-3 rounded mb-4 text-sm">
                        {message}
                    </div>
                )}

                {/* Chats List - Grows to fill available space */}
                <div className="flex-1 overflow-y-auto mb-6">
                    <h2 className="text-xl mb-4">Your Chats</h2>
                    {chats.length === 0 ? (
                        <div className="bg-gray-900 p-6 rounded-2xl text-gray-400 text-center">
                            No chats yet. Start a new chat to begin messaging.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {chats.map((chat) => (
                                <div
                                    key={chat.chat_id}
                                    onClick={() =>
                                        navigate(`/chat/${chat.chat_id}`)
                                    }
                                    className="bg-gradient-to-br from-gray-800 to-gray-900 p-5 rounded-2xl hover:from-gray-700 hover:to-gray-800 transition-colors duration-200 cursor-pointer shadow-lg"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Avatar Circle */}
                                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                                {chat.peer_email.charAt(0).toUpperCase()}
                                            </div>
                                            
                                            {/* Chat Info */}
                                            <div>
                                                <p className="font-semibold text-lg text-white">
                                                    {chat.peer_email}
                                                </p>
                                                <p className="text-sm text-gray-400">
                                                    Tap to open chat
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {/* Notification Badge */}
                                        {chat.unread_count > 0 && (
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                                                <span className="text-sm bg-green-500 text-white px-3 py-1.5 rounded-full font-medium">
                                                    {chat.unread_count}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Start New Chat Section - Fixed at bottom */}
                <div className="bg-gray-900 rounded-2xl p-4 shadow-lg">
                    <h3 className="text-sm text-gray-400 mb-3">Start New Chat</h3>
                    
                    {initError && (
                        <div className="text-red-400 mb-3 text-sm">
                            {initError}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <input
                            type="email"
                            placeholder="Enter email address"
                            value={chatEmail}
                            onChange={(e) => setChatEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !loading && chatEmail.trim()) {
                                    handleInitChat();
                                }
                            }}
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-black border border-gray-700 rounded-xl text-white focus:outline-none focus:border-gray-500 hover:border-gray-600 transition-colors disabled:opacity-50"
                        />
                        <button
                            onClick={handleInitChat}
                            disabled={loading || !chatEmail.trim()}
                            className="px-6 py-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl hover:from-purple-600 hover:to-blue-600 transition-colors duration-200 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        >
                            {loading ? "..." : "Start"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
