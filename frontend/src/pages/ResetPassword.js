import { useState } from "react";
import { useParams } from "react-router-dom";

function ResetPassword() {

  const { token } = useParams();

  const [password, setPassword] = useState("");

  const handleReset = async () => {
    const res = await fetch(
      "http://localhost:5001/api/reset-password",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token, password })
      }
    );

    const data = await res.json();
    alert(data.message);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <h2>Reset password</h2>

        <input
          className="auth-input"
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="btn-primary auth-btn"
          onClick={handleReset}
        >
          Reset password
        </button>

      </div>
    </div>
  );
}

export default ResetPassword;