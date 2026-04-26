import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import API_URL from "../config";

export default function VerifyEmail() {
  const { token }   = useParams();
  const [status,    setStatus]  = useState("verifying"); // "verifying" | "success" | "error"
  const [message,   setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/verify/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.message?.toLowerCase().includes("success") ||
            data.message?.toLowerCase().includes("verified")) {
          setStatus("success");
          setMessage(data.message);
          setTimeout(() => (window.location.href = "/login"), 3000);
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Server error. Please try again.");
      });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>

        {status === "verifying" && (
          <>
            <div style={{
              width: 48, height: 48,
              border: "3px solid var(--border)",
              borderTop: "3px solid var(--navy)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 20px",
            }} />
            <h2 className="auth-title">Verifying your email…</h2>
            <p className="auth-sub">Please wait a moment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <h2 className="auth-title">Email verified!</h2>
            <p className="auth-sub">{message}</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
              Redirecting to sign in…
            </p>
            <Link to="/login" className="btn-primary" style={{ marginTop: 20, justifyContent: "center" }}>
              Go to sign in →
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: 52, marginBottom: 16 }}>❌</div>
            <h2 className="auth-title">Verification failed</h2>
            <p className="auth-sub">{message}</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "12px 0 20px" }}>
              The link may have expired. Request a new verification email from the sign in page.
            </p>
            <Link to="/login" className="btn-primary" style={{ justifyContent: "center" }}>
              Back to sign in →
            </Link>
          </>
        )}

      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
