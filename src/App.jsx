// src/App.jsx
import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import RoutePage from "./pages/RoutePage";
import ChatView from "./pages/ChatView";

/**
 * App.jsx: contains only routes and route protection logic.
 * Protected route: / -> accessible only if JWT exists in localStorage.
 * If not authenticated: redirect to /login
 * If authenticated and user hits /login or /signup, send them to /
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8008";

function isAuthenticated() {
    const token = localStorage.getItem("token");
    return !!token;
}

export default function App() {
    const [auth, setAuth] = useState(isAuthenticated());

    // Listen for storage changes to update auth state
    useEffect(() => {
        const handleStorageChange = () => {
            setAuth(isAuthenticated());
        };

        // Check auth state on mount and when localStorage changes
        handleStorageChange();
        window.addEventListener("storage", handleStorageChange);

        // Also check periodically for same-tab localStorage changes
        const interval = setInterval(handleStorageChange, 100);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                {/* Root is now the protected page */}
                <Route
                    path="/"
                    element={
                        auth ? (
                            <RoutePage apiBase={API_BASE} />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />

                <Route
                    path="/signup"
                    element={
                        auth ? (
                            <Navigate to="/" replace />
                        ) : (
                            <Signup apiBase={API_BASE} />
                        )
                    }
                />

                <Route
                    path="/login"
                    element={
                        auth ? (
                            <Navigate to="/" replace />
                        ) : (
                            <Login apiBase={API_BASE} />
                        )
                    }
                />

                {/* Chat view route (protected) */}
                <Route
                    path="/chat/:chatId"
                    element={
                        auth ? (
                            <ChatView apiBase={API_BASE} />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />

                {/* Backward compatibility: redirect old /route to new root */}
                <Route path="/route" element={<Navigate to="/" replace />} />

                {/* Catch all: if logged in send to / else /login */}
                <Route
                    path="*"
                    element={<Navigate to={auth ? "/" : "/login"} replace />}
                />
            </Routes>
        </BrowserRouter>
    );
}
