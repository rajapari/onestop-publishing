import "./App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import React, { useState, useEffect, useRef } from "react";
import Landing        from "./pages/Landing";
import Login          from "./pages/Login";
import Signup         from "./pages/Signup";
import Dashboard      from "./pages/Dashboard";
import ProjectDetail  from "./pages/ProjectDetail";
import Editor         from "./pages/Editor";
import WordOnlineEditor from "./pages/WordOnlineEditor";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword  from "./pages/ResetPassword";
import VerifyEmail    from "./pages/VerifyEmail";

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getTokenPayload() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64    = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
}

function ProtectedRoute({ children }) {
  const token    = localStorage.getItem("token");
  const params   = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (!token && !urlToken) {
    window.location.replace("/login");
    return null;
  }
  return children;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [open, setOpen]   = useState(false);
  const dropRef           = useRef(null);
  const payload           = getTokenPayload();

  const initials = payload?.name
    ? payload.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : "U";

  const isEditorPage =
    window.location.pathname.startsWith("/editor/") ||
    window.location.pathname.startsWith("/word-editor/");

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <BrowserRouter>
      {!isEditorPage && (
        <nav className="topbar">
          <div className="brand">
            {window.location.pathname === "/" ? (
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
                <div
                  className="profile-trigger"
                  onClick={() => setOpen(!open)}
                  title={payload?.name || "Account"}
                >
                  <div className="profile-initial">{initials}</div>
                </div>

                {open && (
                  <div className="profile-dropdown">
                    <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#0F2344" }}>
                        {payload?.name || "User"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#5C6B8A", marginTop: "2px" }}>
                        {payload?.email || ""}
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
      )}

      <Routes>
        <Route path="/"             element={<Landing />} />
        <Route path="/login"        element={<Login />} />
        <Route path="/signup"       element={<Signup />} />
        <Route path="/forgot"       element={<ForgotPassword />} />
        <Route path="/reset/:token" element={<ResetPassword />} />
        <Route path="/verify/:token" element={<VerifyEmail />} />

        <Route path="/dashboard"    element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/project/:id"  element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
        <Route path="/editor/:id"   element={<ProtectedRoute><Editor /></ProtectedRoute>} />
        <Route path="/word-editor/:id" element={<ProtectedRoute><WordOnlineEditor /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
