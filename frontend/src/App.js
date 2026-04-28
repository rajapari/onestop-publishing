import "./App.css";
import {
  BrowserRouter, Routes, Route, Link, useLocation,
} from "react-router-dom";
import React, { useState, useEffect, useRef } from "react";
import Landing          from "./pages/Landing";
import Login            from "./pages/Login";
import Signup           from "./pages/Signup";
import Dashboard        from "./pages/Dashboard";
import ProjectDetail    from "./pages/ProjectDetail";
import Editor           from "./pages/Editor";
import WordOnlineEditor from "./pages/WordOnlineEditor";
import ForgotPassword   from "./pages/ForgotPassword";
import ResetPassword    from "./pages/ResetPassword";
import VerifyEmail      from "./pages/VerifyEmail";

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  publisher_admin: "Publisher Admin",
  editor_in_chief: "Editor-in-Chief",
  managing_editor: "Managing Editor",
  section_editor:  "Section Editor",
  copy_editor:     "Copy Editor",
  peer_reviewer:   "Peer Reviewer",
  author:          "Author",
  subscriber:      "Subscriber",
};

const ROLE_COLORS = {
  publisher_admin: { bg: "#0F2344", color: "#F5C842" },
  editor_in_chief: { bg: "#1B3A6B", color: "#60A5FA" },
  managing_editor: { bg: "#1D4ED8", color: "#BFDBFE" },
  section_editor:  { bg: "#065F46", color: "#6EE7B7" },
  copy_editor:     { bg: "#92400E", color: "#FDE68A" },
  peer_reviewer:   { bg: "#4C1D95", color: "#DDD6FE" },
  author:          { bg: "#1D9E8C", color: "#FFFFFF" },
  subscriber:      { bg: "#475569", color: "#E2E8F0" },
};

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getTokenPayload() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64    = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload   = JSON.parse(window.atob(base64));

    // Check token expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem("token");
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function getInitials(name) {
  if (!name || name.trim() === "") return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function ProtectedRoute({ children }) {
  const params   = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");

  // Accept token from URL (OAuth redirect) and store it
  if (urlToken) {
    localStorage.setItem("token", urlToken);
  }

  const payload = getTokenPayload();
  if (!payload) {
    window.location.replace("/login");
    return null;
  }
  return children;
}

// ── Navbar — uses useLocation so it re-renders on route change ────────────────
function Navbar() {
  const location          = useLocation();
  const [open, setOpen]   = useState(false);
  const [payload, setPayload] = useState(getTokenPayload);
  const dropRef           = useRef(null);

  // Re-read token whenever route changes (fixes "sign in" showing while logged in)
  useEffect(() => {
    setPayload(getTokenPayload());
    setOpen(false);
  }, [location.pathname, location.search]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isEditorPage =
    location.pathname.startsWith("/editor/") ||
    location.pathname.startsWith("/word-editor/");

  if (isEditorPage) return null;

  // ── Read claims from JWT payload ──────────────────────────────────────────
  // Flask-JWT-Extended stores name/email/role as top-level claims
  const userName  = payload?.name  || "";
  const userEmail = payload?.email || payload?.sub || "";
  const userRole  = payload?.role  || "author";
  const initials  = getInitials(userName) || (userEmail ? userEmail[0].toUpperCase() : "?");
  const roleStyle = ROLE_COLORS[userRole] || ROLE_COLORS.author;

  return (
    <nav className="topbar">
      <div className="brand">
        {location.pathname === "/" ? (
          <span className="brand-logo">OneStop <span>Publishing</span></span>
        ) : (
          <Link to="/" className="brand-link">
            <span className="brand-logo">OneStop <span>Publishing</span></span>
          </Link>
        )}
      </div>

      <div className="nav-right">
        {payload ? (
          <div className="profile-wrapper" ref={dropRef}>
            {/* Avatar bubble */}
            <div
              className="profile-trigger"
              onClick={() => setOpen(!open)}
              title={userName || userEmail}
              style={{ cursor: "pointer" }}
            >
              <div
                className="profile-initial"
                style={{ background: roleStyle.bg, color: roleStyle.color }}
              >
                {initials}
              </div>
            </div>

            {/* Dropdown */}
            {open && (
              <div className="profile-dropdown">
                {/* User info */}
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F2344" }}>
                    {userName || "User"}
                  </div>
                  <div style={{ fontSize: 12, color: "#5C6B8A", marginTop: 2 }}>
                    {userEmail}
                  </div>
                  {/* Role badge */}
                  <div style={{
                    display: "inline-block",
                    marginTop: 8,
                    padding: "3px 10px",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 700,
                    background: roleStyle.bg,
                    color: roleStyle.color,
                  }}>
                    {ROLE_LABELS[userRole] || "Author"}
                  </div>
                </div>

                <div
                  className="dropdown-item"
                  onClick={() => { setOpen(false); window.location.href = "/dashboard"; }}
                >
                  📁 My Projects
                </div>

                <div
                  className="dropdown-item logout"
                  onClick={() => {
                    localStorage.removeItem("token");
                    window.location.href = "/";
                  }}
                >
                  → Sign out
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link to="/login"  className="btn-login">Sign in</Link>
            <Link to="/signup" className="btn-signup">Get Started Free</Link>
          </>
        )}
      </div>
    </nav>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"              element={<Landing />} />
        <Route path="/login"         element={<Login />} />
        <Route path="/signup"        element={<Signup />} />
        <Route path="/forgot"        element={<ForgotPassword />} />
        <Route path="/reset/:token"  element={<ResetPassword />} />
        <Route path="/verify/:token" element={<VerifyEmail />} />

        <Route path="/dashboard"   element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
        <Route path="/editor/:id"  element={<ProtectedRoute><Editor /></ProtectedRoute>} />
        <Route path="/word-editor/:id" element={<ProtectedRoute><WordOnlineEditor /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
