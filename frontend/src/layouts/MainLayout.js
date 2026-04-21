import { Link } from "react-router-dom";
import { useState } from "react";

function MainLayout({ children, user }) {

  const [open, setOpen] = useState(false);

  return (
    <div className="layout">

      {/* Header */}
      <header className="header">

        <Link to="/" className="brand-link">
          <span className="gradient-text">
            OneStop Publishing
          </span>
        </Link>

        {user && (
          <div className="profile-wrapper">

            <div
              className="profile-trigger"
              onClick={() => setOpen(!open)}
            >

              {user?.picture ? (
                <img
                  src={user.picture}
                  alt="profile"
                  className="profile-avatar"
                />
              ) : (
                <div className="profile-initial">
                  {(user?.name || user?.email || "U")
                    .substring(0,2)
                    .toUpperCase()}
                </div>
              )}

            </div>

            {open && (
              <div className="profile-dropdown">

                <div className="profile-name">
                  {user?.name || user?.email}
                </div>

                <div
                  className="dropdown-item"
                  onClick={() =>
                    window.location="/dashboard"
                  }
                >
                  Dashboard
                </div>

                <div
                  className="dropdown-item logout"
                  onClick={() => {
                    localStorage.removeItem("token");
                    window.location="/";
                  }}
                >
                  Logout
                </div>

              </div>
            )}

          </div>
        )}

      </header>

      {/* Page content */}
      <main className="main">
        {children}
      </main>

    </div>
  );
}

export default MainLayout;