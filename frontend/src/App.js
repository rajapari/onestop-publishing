import "./App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import React, { useState } from "react";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import Editor from "./pages/Editor";
import WordOnlineEditor from "./pages/WordOnlineEditor";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import "./styles/app.css";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get("token");
  if (!token && !urlToken) {
    window.location.replace("/login");
    return null;
  }
  return children;
}

function getUserFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(base64));
    return payload.sub;
  } catch {
    return null;
  }
}

function App() {
  const [open, setOpen] = useState(false);
  const user = getUserFromToken();

  // Hide navbar in full-screen editor pages
  const isEditorPage =
    window.location.pathname.startsWith("/editor/") ||
    window.location.pathname.startsWith("/word-editor/");

  return (
    <BrowserRouter>

      {!isEditorPage && (
        <nav className="topbar">
          <div className="brand">
            {window.location.pathname === "/" ? (
              <span className="gradient-text">OneStop Publishing</span>
            ) : (
              <Link to="/" className="brand-link">
                <span className="gradient-text">OneStop Publishing</span>
              </Link>
            )}
          </div>

          <div className="nav-right">
            {user ? (
              <div className="profile-wrapper">
                <div className="profile-trigger" onClick={() => setOpen(!open)}>
                  {user?.picture ? (
                    <img src={user.picture} alt={user?.name || "User"} className="profile-avatar" />
                  ) : (
                    <div className="profile-initial">
                      {(user?.name
                        ? user.name.split(" ").map((n) => n[0]).join("")
                        : user?.email || "U"
                      ).substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {open && (
                  <div className="profile-dropdown">
                    <div className="profile-initial">
                      {(user?.name
                        ? user.name.split(" ").map((n) => n[0]).join("")
                        : user?.email || "U"
                      ).substring(0, 2).toUpperCase()}
                    </div>
                    <div className="dropdown-item" onClick={() => (window.location.href = "/dashboard")}>
                      Project Dashboard
                    </div>
                    <div className="dropdown-item logout" onClick={() => {
                      localStorage.removeItem("token");
                      window.location.href = "/";
                    }}>
                      Logout
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-login">Login</Link>
                <Link to="/signup" className="btn-signup">Get Started Free</Link>
              </>
            )}
          </div>
        </nav>
      )}

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/reset/:token" element={<ResetPassword />} />
        <Route path="/verify/:token" element={<VerifyEmail />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />

        {/* LibreOffice / Collabora editor */}
        <Route path="/editor/:id" element={<ProtectedRoute><Editor /></ProtectedRoute>} />

        {/* Word 365 Online editor */}
        <Route path="/word-editor/:id" element={<ProtectedRoute><WordOnlineEditor /></ProtectedRoute>} />
      </Routes>

    </BrowserRouter>
  );
}

export default App;
