import { useState } from "react";
import { Link } from "react-router-dom";

function Signup() {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {

    if (name.length < 3) {
      alert("Name must be at least 3 characters");
      return false;
    }

    const emailRegex = /\S+@\S+\.\S+/;

    if (!emailRegex.test(email)) {
      alert("Enter a valid email address");
      return false;
    }

    if (password.length < 8) {
      alert("Password must be at least 8 characters");
      return false;
    }

    const strongPassword =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/;

    if (!strongPassword.test(password)) {
      alert(
        "Password must include uppercase, lowercase, number and special character"
      );
      return false;
    }

    return true;
  };

  const getStrength = (password) => {
  let score = 0;

  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  return score;
};
  const handleSignup = async () => {

    if (!validateForm()) return;

    try {

      const response = await fetch(
        "http://localhost:5001/api/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name,
            email,
            password
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert("Account created successfully!");
        window.location.href = "/login";
      } else {
        alert(data.error);
      }

    } catch (error) {
      console.error(error);
      alert("Server error");
    }
  };

  return (
    <div className="auth-page">

      <div className="auth-card">
        <form autoComplete="off">
          <input type="text" name="fakeuser" autoComplete="username" style={{display:"none"}} />

        <h2 className="auth-title">Create your account</h2>

        <p className="auth-sub">
          Start using OneStop Publishing
        </p>

        <input
          className="auth-input"
          name="fullName"
          autoComplete="off"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="auth-input"
          name="signup-email"
          autoComplete="new-email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        
        <div className="password-field">
          <input
            className="auth-input"
            type="password"
            name="new-password"
            autoComplete="new-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <span
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide" : "Show"}
          </span>
        </div>

        <div className="strength">
          <div
          className={`strength-bar strength-${getStrength(password)}`}
          ></div>
        </div>

        <div className="password-rules">
          Password must contain:
          <br/>
          • Minimum 8 characters
          <br/>
          • Uppercase letter
          <br/>
          • Number
          <br/>
          • Special character
        </div>

        <button
          className="btn-primary auth-btn"
          onClick={handleSignup}
        >
          Create account
        </button>

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
            alt="google"
          />
          Continue with Google
        </button>

        <button
          className="social-btn"
          onClick={() =>
            alert("LinkedIn signup coming soon")
          }
        >
          <img
            src="https://www.svgrepo.com/show/448234/linkedin.svg"
            alt="linkedin"
          />
          Continue with LinkedIn
        </button>

        <p className="auth-footer">
          Already have an account?
          <Link to="/login"> Sign in</Link>
        </p>

        </form>
      </div>

    </div>
  );
}

export default Signup;