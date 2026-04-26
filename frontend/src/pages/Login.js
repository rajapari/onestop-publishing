import { useState } from "react";
import { Link } from "react-router-dom";
import API_URL from "../config";

export default function Login() {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [error,       setError]       = useState("");
  const [message,     setMessage]     = useState("");
  const [loading,     setLoading]     = useState(false);
  const [showResend,  setShowResend]  = useState(false);
  const [showPass,    setShowPass]    = useState(false);

  const handleLogin = async () => {
    setError(""); setMessage(""); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (res.ok && data.token) {
        localStorage.setItem("token", data.token);
        window.location.href = "/dashboard";
        return;
      }
      if (data.message?.toLowerCase().includes("verify")) setShowResend(true);
      setError(data.message || "Login failed");
    } catch {
      setError("Server error. Please try again.");
    }
    setLoading(false);
  };

  const resendVerification = async () => {
    setError(""); setMessage("");
    try {
      const res  = await fetch(`${API_URL}/api/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message);
    } catch {
      setError("Server error.");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-badge">Sign In</div>

        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-sub">
          Continue to your OneStop Publishing workspace
        </p>

        <input
          className="auth-input"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          autoComplete="email"
        />

        <div className="password-field">
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoComplete="current-password"
          />
          <span className="toggle-password" onClick={() => setShowPass(!showPass)}>
            {showPass ? "Hide" : "Show"}
          </span>
        </div>

        <div className="forgot">
          <Link to="/forgot">Forgot password?</Link>
        </div>

        {error   && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <button
          className="btn-primary auth-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in →"}
        </button>

        {showResend && (
          <button className="btn-outline resend-btn" onClick={resendVerification}>
            Resend verification email
          </button>
        )}

        <div className="auth-divider"><span>or continue with</span></div>

        <button
          className="social-btn"
          onClick={() => (window.location.href = `${API_URL}/auth/google`)}
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
          Continue with Google
        </button>

        <button className="social-btn" onClick={() => alert("LinkedIn login coming soon")}>
          <img src="https://www.svgrepo.com/show/448234/linkedin.svg" alt="LinkedIn" />
          Continue with LinkedIn
        </button>

        <p className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up free</Link>
        </p>
      </div>
    </div>
  );
}
