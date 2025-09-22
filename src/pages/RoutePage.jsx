// src/pages/RoutePage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function RoutePage({ apiBase }) {
    const navigate = useNavigate();
    const [message, setMessage] = useState("Loading...");
    const [err, setErr] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            navigate("/login");
            return;
        }

        (async () => {
            try {
                const res = await fetch(`${apiBase}/protected`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    setMessage(
                        data.message ||
                            "You have access to this protected route."
                    );
                    return;
                }

                // If unauthorized, clear token and redirect to login
                if (res.status === 401 || res.status === 403) {
                    setErr(data.detail || data.error || "Unauthorized");
                    localStorage.removeItem("token");
                    setTimeout(() => navigate("/login"), 800);
                    return;
                }

                // For other errors (e.g., backend down), show error but do not logout
                setErr(
                    data.detail || data.error || `Error ${res.status || ""}`
                );
            } catch (error) {
                // Network or unexpected error: show message but keep token
                setErr(error?.message || "Network error");
            }
        })();
    }, [apiBase, navigate]);

    const logout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="w-full max-w-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl">Protected Page</h1>
                    <button
                        onClick={logout}
                        className="px-3 py-1 bg-gray-900 rounded"
                    >
                        Logout
                    </button>
                </div>

                {err && <div className="text-red-400 mb-4">{err}</div>}

                <div className="bg-gray-900 p-4 rounded">
                    <p>{message}</p>
                </div>
            </div>
        </div>
    );
}
