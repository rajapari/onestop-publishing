import { useState } from "react";
import { Link } from "react-router-dom";

function Login() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);


  const handleLogin = async () => {

    setError("");
    setMessage("");
    setLoading(true);

    try {

      const response = await fetch(
        "http://localhost:5001/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        }
      );

      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem("token", data.token);
        window.location.href = "/dashboard";
        return;
      }

      if (data.message?.toLowerCase().includes("verify")) {
        setShowResend(true);
      }

      setError(data.message || "Login failed");

    } catch (error) {

      setError("Server error");

    }

    setLoading(false);
  };


  const resendVerification = async () => {

    setError("");
    setMessage("");

    try {

      const res = await fetch(
        "http://localhost:5001/api/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email })
        }
      );

      const data = await res.json();

      setMessage(data.message);

    } catch {
      setError("Server error");
    }

  };


  return (
    <div className="auth-page">
      <div className="auth-card">

        <h2 className="auth-title">Welcome back</h2>

        <p className="auth-sub">
          Sign in to continue to OneStop Publishing
        </p>

        <input
          className="auth-input"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="auth-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="forgot">
          <Link to="/forgot">Forgot password?</Link>
        </div>


        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        {message && (
          <div className="auth-success">
            {message}
          </div>
        )}


        <button
          className="btn-primary auth-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>


        {showResend && (
          <button
            className="btn-outline resend-btn"
            onClick={resendVerification}
          >
            Resend verification email
          </button>
        )}


        <div className="auth-divider">
          <span>or</span>
        </div>


        <button
          className="social-btn"
          onClick={() =>
            window.location.href =
            "http://localhost:5001/auth/google"
          }
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google"
          />
          Continue with Google
        </button>


        <button
          className="social-btn"
          onClick={() =>
            alert("LinkedIn login coming soon")
          }
        >
          <img
            src="https://www.svgrepo.com/show/448234/linkedin.svg"
            alt="LinkedIn"
          />
          Continue with LinkedIn
        </button>


        <p className="auth-footer">
          Don’t have an account?
          <Link to="/signup"> Sign up</Link>
        </p>

      </div>
    </div>
  );
}

export default Login;