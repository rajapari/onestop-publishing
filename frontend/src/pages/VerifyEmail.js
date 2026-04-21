import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function VerifyEmail() {

  const { token } = useParams();
  const [status, setStatus] = useState("Verifying...");

  useEffect(() => {

    fetch(`http://localhost:5001/api/verify/${token}`)
      .then(res => res.json())
      .then(data => {

        setStatus(data.message);

        setTimeout(() => {
          window.location = "/login";
        }, 2000);

      });

  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card">

        <h2>Email verification</h2>

        <p>{status}</p>

      </div>
    </div>
  );
}

export default VerifyEmail;