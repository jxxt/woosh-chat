// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import RoutePage from "./pages/RoutePage";

/**
 * App.jsx: contains only routes and route protection logic.
 * Protected route: /route -> accessible only if JWT exists in localStorage.
 * If not authenticated: redirect to /login
 * If authenticated and user hits /login or /signup, send them to /route
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8008";

function isAuthenticated() {
  const token = localStorage.getItem("token");
  return !!token;
}

export default function App() {
  const auth = isAuthenticated();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={auth ? "/route" : "/login"} replace />}
        />

        <Route
          path="/signup"
          element={auth ? <Navigate to="/route" replace /> : <Signup apiBase={API_BASE} />}
        />

        <Route
          path="/login"
          element={auth ? <Navigate to="/route" replace /> : <Login apiBase={API_BASE} />}
        />

        <Route
          path="/route"
          element={auth ? <RoutePage apiBase={API_BASE} /> : <Navigate to="/login" replace />}
        />

        {/* Catch all: if logged in send to /route else /login */}
        <Route
          path="*"
          element={<Navigate to={auth ? "/route" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
