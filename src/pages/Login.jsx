// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login({ apiBase }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setErr("");
        try {
            const res = await fetch(`${apiBase}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok)
                throw new Error(data.detail || data.error || "Login failed");
            // store JWT in localStorage
            localStorage.setItem("token", data.token);
            // redirect to protected root page
            navigate("/", { replace: true });
        } catch (error) {
            setErr(error.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
            <div className="w-full max-w-md p-6">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        WooshChat
                    </h1>
                    <p className="text-gray-400 text-sm">
                        A Secure Ephemeral Messaging Application
                    </p>
                </div>
                <h2 className="text-2xl mb-4">Login</h2>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block text-sm mb-1">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded bg-gray-800 text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded bg-gray-800 text-white"
                        />
                    </div>

                    {err && <div className="text-red-400 text-sm">{err}</div>}

                    <div>
                        <button
                            type="submit"
                            className="w-full py-2 rounded bg-gray-900 text-white cursor-pointer hover:bg-gray-800 transition-colors"
                        >
                            Login
                        </button>
                    </div>

                    <div className="text-sm text-gray-400">
                        Don’t have an account?{" "}
                        <button
                            type="button"
                            onClick={() => navigate("/signup")}
                            className="underline cursor-pointer hover:text-gray-300 transition-colors"
                        >
                            Signup
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
