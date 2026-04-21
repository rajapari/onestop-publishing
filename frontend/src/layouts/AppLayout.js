import { Link } from "react-router-dom";

function AppLayout({ children }) {
  return (
    <div className="app">
      
      {/* Sidebar */}
      <div className="sidebar">
        <h2 className="logo">ManuscriptAI</h2>

        <Link to="/dashboard">Dashboard</Link>
        <Link to="/projects">Projects</Link>
        <Link to="/files">Files</Link>
        <Link to="/settings">Settings</Link>
      </div>

      {/* Main */}
      <div className="main">
        <div className="header">
          <input placeholder="Search..." className="search" />
          <div className="user">👤</div>
        </div>

        <div className="content">
          {children}
        </div>
      </div>

    </div>
  );
}

export default AppLayout;