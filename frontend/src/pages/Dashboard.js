import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import axios from "axios";
import API_URL from "../config";

function getTokenPayload() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64    = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(window.atob(base64));
  } catch { return null; }
}

export default function Dashboard() {
  const location = useLocation();

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [projects,    setProjects]    = useState([]);
  const [creating,    setCreating]    = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [error,       setError]       = useState("");

  const user = getTokenPayload();

  // Capture JWT from OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token  = params.get("token");
    if (token) localStorage.setItem("token", token);
    loadProjects();
  }, [location.search]); // eslint-disable-line

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const loadProjects = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/projects`, { headers: authHeaders() });
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const createProject = async () => {
    if (!title.trim()) { setError("Project title is required"); return; }
    setCreating(true); setError("");
    try {
      await axios.post(
        `${API_URL}/api/projects`,
        { title, description },
        { headers: authHeaders() }
      );
      setTitle(""); setDescription(""); setShowForm(false);
      loadProjects();
    } catch {
      setError("Error creating project. Please try again.");
    }
    setCreating(false);
  };

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="dashboard-layout">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Workspace</div>
          <div className="sidebar-item active">
            <span className="sidebar-icon">📁</span> Projects
          </div>
          <div className="sidebar-item" onClick={() => alert("Coming soon")}>
            <span className="sidebar-icon">📊</span> Analytics
          </div>
          <div className="sidebar-item" onClick={() => alert("Coming soon")}>
            <span className="sidebar-icon">⚙️</span> Settings
          </div>
        </div>

        <div className="sidebar-section" style={{ marginTop: "auto", paddingTop: 24 }}>
          <div className="sidebar-label">Account</div>
          <div
            className="sidebar-item"
            onClick={() => { localStorage.removeItem("token"); window.location.href = "/"; }}
            style={{ color: "#DC2626" }}
          >
            <span className="sidebar-icon">→</span> Sign out
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">

        {/* Page Header */}
        <div className="page-header">
          <h1>
            {greet()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p>Manage your publishing projects from one place.</p>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
          {[
            { label: "Total Projects", value: projects.length, icon: "📁" },
            { label: "Active",         value: projects.length, icon: "✅" },
            { label: "Collaborators",  value: "—",             icon: "👥" },
          ].map((s, i) => (
            <div key={i} style={{
              flex: "1 1 140px",
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "18px 20px",
              boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 700,
                color: "var(--navy)",
              }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Projects header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--navy)",
          }}>
            Your Projects
          </h2>
          <button
            className="btn-primary"
            style={{ padding: "9px 18px", fontSize: 13 }}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "✕ Cancel" : "+ New Project"}
          </button>
        </div>

        {/* New Project Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 20, borderColor: "var(--navy)", borderWidth: 1.5 }}>
            <div className="card-title">Create New Project</div>
            {error && <div className="auth-error" style={{ marginBottom: 14 }}>{error}</div>}
            <div className="form-row">
              <input
                className="input"
                placeholder="Project title *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createProject()}
                autoFocus
              />
              <textarea
                className="textarea"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={createProject}
                  disabled={creating}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {creating ? "Creating…" : "Create Project →"}
                </button>
                <button
                  className="btn-outline"
                  onClick={() => { setShowForm(false); setError(""); }}
                  style={{ padding: "12px 20px" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "64px 24px",
            color: "var(--text-muted)",
            background: "white",
            border: "1px dashed var(--border-dark)",
            borderRadius: "var(--radius-md)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
            <h3 style={{ fontFamily: "var(--font-display)", color: "var(--navy)", marginBottom: 8 }}>
              No projects yet
            </h3>
            <p style={{ fontSize: 14, marginBottom: 20 }}>
              Create your first publishing project to get started.
            </p>
            <button
              className="btn-primary"
              onClick={() => setShowForm(true)}
              style={{ margin: "0 auto" }}
            >
              + Create your first project
            </button>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((p) => (
              <div className="project-card" key={p.id}>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(15,35,68,0.06)",
                  color: "var(--navy)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 100,
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                }}>
                  📁 Project #{p.id}
                </div>
                <h3>{p.title}</h3>
                <p>{p.description || "No description provided."}</p>
                <Link to={`/project/${p.id}`} className="open-btn">
                  Open project →
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
