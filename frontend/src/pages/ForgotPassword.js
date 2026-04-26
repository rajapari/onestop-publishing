import { useState } from "react";
import { Link } from "react-router-dom";
import API_URL from "../config";

export default function ForgotPassword() {
  const [email,     setEmail]     = useState("");
  const [status,    setStatus]    = useState(null); // "success" | "error"
  const [message,   setMessage]   = useState("");
  const [loading,   setLoading]   = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) { setStatus("error"); setMessage("Please enter your email address."); return; }
    setLoading(true); setStatus(null);
    try {
      const res  = await fetch(`${API_URL}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Reset link sent! Please check your inbox.");
      } else {
        setStatus("error");
        setMessage(data.message || "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Server error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-badge">Password Reset</div>

        <h2 className="auth-title">Forgot your password?</h2>
        <p className="auth-sub">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {status === "error"   && <div className="auth-error">{message}</div>}
        {status === "success" && (
          <div className="auth-success">
            ✅ {message}
          </div>
        )}

        {status !== "success" && (
          <>
            <input
              className="auth-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoComplete="email"
              autoFocus
            />

            <button
              className="btn-primary auth-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Sending…" : "Send reset link →"}
            </button>
          </>
        )}

        <p className="auth-footer" style={{ marginTop: 20 }}>
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
