import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import API_URL from "../config";

function getStrength(password) {
  let score = 0;
  if (password.length >= 8)           score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[0-9]/.test(password))         score++;
  if (/[^A-Za-z0-9]/.test(password))  score++;
  return score;
}

const strengthColor = ["", "#EF4444", "#F97316", "#EAB308", "#22C55E"];
const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];

export default function ResetPassword() {
  const { token }   = useParams();
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [status,    setStatus]    = useState(null);
  const [message,   setMessage]   = useState("");
  const [loading,   setLoading]   = useState(false);

  const strength = getStrength(password);

  const handleReset = async () => {
    if (password.length < 8) {
      setStatus("error");
      setMessage("Password must be at least 8 characters.");
      return;
    }
    setLoading(true); setStatus(null);
    try {
      const res  = await fetch(`${API_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "Password reset successfully!");
        setTimeout(() => (window.location.href = "/login"), 2500);
      } else {
        setStatus("error");
        setMessage(data.message || "Reset failed. The link may have expired.");
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
        <div className="auth-badge">New Password</div>

        <h2 className="auth-title">Reset your password</h2>
        <p className="auth-sub">Choose a strong new password for your account.</p>

        {status === "error"   && <div className="auth-error">{message}</div>}
        {status === "success" && (
          <div className="auth-success">
            ✅ {message} Redirecting to sign in…
          </div>
        )}

        {status !== "success" && (
          <>
            <div className="password-field">
              <input
                className="auth-input"
                type={showPass ? "text" : "password"}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReset()}
                autoFocus
              />
              <span className="toggle-password" onClick={() => setShowPass(!showPass)}>
                {showPass ? "Hide" : "Show"}
              </span>
            </div>

            <div className="strength">
              <div
                className={`strength-bar strength-${strength}`}
                style={{ background: strengthColor[strength] }}
              />
            </div>
            {password && (
              <div style={{ fontSize: 12, color: strengthColor[strength], marginBottom: 14, fontWeight: 600 }}>
                {strengthLabel[strength]} password
              </div>
            )}

            <div className="password-rules">
              Must contain: uppercase · lowercase · number · special character · min 8 chars
            </div>

            <button
              className="btn-primary auth-btn"
              onClick={handleReset}
              disabled={loading}
            >
              {loading ? "Resetting…" : "Reset password →"}
            </button>
          </>
        )}

        <p className="auth-footer">
          <Link to="/login">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
