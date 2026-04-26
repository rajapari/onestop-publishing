import { useState } from "react";
import { Link } from "react-router-dom";
import API_URL from "../config";

function getStrength(password) {
  let score = 0;
  if (password.length >= 8)       score++;
  if (/[A-Z]/.test(password))     score++;
  if (/[0-9]/.test(password))     score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["", "#EF4444", "#F97316", "#EAB308", "#22C55E"];

export default function Signup() {
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  const strength = getStrength(password);

  const validateForm = () => {
    if (name.trim().length < 3)            { setError("Name must be at least 3 characters"); return false; }
    if (!/\S+@\S+\.\S+/.test(email))      { setError("Enter a valid email address"); return false; }
    if (password.length < 8)               { setError("Password must be at least 8 characters"); return false; }
    if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
      setError("Password must include uppercase, lowercase, number and special character");
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    setError("");
    if (!validateForm()) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Account created! Please check your email to verify your account.");
        window.location.href = "/login";
      } else {
        setError(data.error || "Signup failed");
      }
    } catch {
      setError("Server error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-badge">Create Account</div>

        <h2 className="auth-title">Join OneStop Publishing</h2>
        <p className="auth-sub">Start your free account — no credit card required</p>

        {error && <div className="auth-error">{error}</div>}

        <input
          className="auth-input"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />

        <input
          className="auth-input"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <div className="password-field">
          <input
            className="auth-input"
            type={showPass ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <span className="toggle-password" onClick={() => setShowPass(!showPass)}>
            {showPass ? "Hide" : "Show"}
          </span>
        </div>

        {/* Strength bar */}
        <div className="strength">
          <div
            className={`strength-bar strength-${strength}`}
            style={{ background: strengthColor[strength] }}
          />
        </div>
        {password && (
          <div style={{ fontSize: 12, color: strengthColor[strength], marginBottom: 8, fontWeight: 600 }}>
            {strengthLabel[strength]} password
          </div>
        )}

        <div className="password-rules">
          Must contain: uppercase letter · lowercase letter · number · special character (@$!%*?&) · min 8 chars
        </div>

        <button
          className="btn-primary auth-btn"
          onClick={handleSignup}
          disabled={loading}
        >
          {loading ? "Creating account…" : "Create account →"}
        </button>

        <div className="auth-divider"><span>or sign up with</span></div>

        <button
          className="social-btn"
          onClick={() => (window.location.href = `${API_URL}/auth/google`)}
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
          Continue with Google
        </button>

        <button className="social-btn" onClick={() => alert("LinkedIn signup coming soon")}>
          <img src="https://www.svgrepo.com/show/448234/linkedin.svg" alt="LinkedIn" />
          Continue with LinkedIn
        </button>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
