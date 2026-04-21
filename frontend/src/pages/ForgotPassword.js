import { useState } from "react";

function ForgotPassword() {
  const [email, setEmail] = useState("");

  const handleSubmit = async () => {
    try {
      const res = await fetch(
        "http://localhost:5001/api/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email })
        }
      );

      const data = await res.json();

      alert(data.message);

    } catch (err) {
      alert("Server error");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <h2>Forgot password</h2>

        <p className="auth-sub">
          Enter your email to reset password
        </p>

        <input
          className="auth-input"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          className="btn-primary auth-btn"
          onClick={handleSubmit}
        >
          Send reset link
        </button>

      </div>
    </div>
  );
}

export default ForgotPassword;