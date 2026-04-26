import { useState, useEffect } from "react";
import axios from "axios";
import API_URL from "../config";

const ROLES = [
  {
    value: "editor",
    label: "Editor",
    desc: "Can view and edit the document",
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
  },
  {
    value: "reviewer",
    label: "Reviewer",
    desc: "Can view but not edit (read-only)",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
  },
];

export default function CollaboratorsPanel({ projectId, manuscriptName, isOwner, onClose }) {
  const [collaborators, setCollaborators] = useState([]);
  const [email,         setEmail]         = useState("");
  const [role,          setRole]          = useState("reviewer");
  const [loading,       setLoading]       = useState(true);
  const [adding,        setAdding]        = useState(false);
  const [status,        setStatus]        = useState(null);

  const token   = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/api/collaborators/${projectId}/${encodeURIComponent(manuscriptName)}`,
        { headers }
      );
      setCollaborators(res.data);
    } catch (err) {
      console.error("Load collaborators error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId, manuscriptName]); // eslint-disable-line

  const invite = async () => {
    if (!email.trim()) return;
    setAdding(true); setStatus(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/collaborators/${projectId}/${encodeURIComponent(manuscriptName)}`,
        { email: email.trim().toLowerCase(), role },
        { headers }
      );
      setStatus({ type: "success", msg: res.data.message });
      setEmail("");
      load();
    } catch (err) {
      setStatus({ type: "error", msg: err.response?.data?.error || "Failed to add collaborator" });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (collabId, name) => {
    if (!window.confirm(`Remove ${name} from this document?`)) return;
    try {
      await axios.delete(`${API_URL}/api/collaborators/${collabId}`, { headers });
      load();
    } catch (err) { console.error("Remove error:", err); }
  };

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.badge}>Collaborators</div>
            <h3 style={s.title}>Manage Access</h3>
            <p style={s.subtitle}>{manuscriptName}</p>
          </div>
          <button style={s.closeBtn} onClick={onClose} title="Close">✕</button>
        </div>

        {/* Invite Form */}
        {isOwner && (
          <div style={s.section}>
            <p style={s.sectionLabel}>INVITE COLLABORATOR</p>

            <input
              style={s.input}
              type="email"
              placeholder="colleague@institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
            />

            {/* Role Selector */}
            <div style={s.roleGrid}>
              {ROLES.map((r) => (
                <div
                  key={r.value}
                  style={s.roleCard(role === r.value, r)}
                  onClick={() => setRole(r.value)}
                >
                  <div style={s.roleRadio(role === r.value)} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "var(--navy)", marginBottom: 2 }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              style={{
                ...s.inviteBtn,
                opacity: adding || !email.trim() ? 0.6 : 1,
                cursor: adding || !email.trim() ? "not-allowed" : "pointer",
              }}
              onClick={invite}
              disabled={adding || !email.trim()}
            >
              {adding ? "Sending invite…" : "Send Invite →"}
            </button>

            {status && (
              <div style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                background: status.type === "success" ? "#F0FDF4" : "#FEF2F2",
                color:      status.type === "success" ? "#16A34A" : "#DC2626",
                border:     `1px solid ${status.type === "success" ? "#BBF7D0" : "#FECACA"}`,
              }}>
                {status.type === "success" ? "✅ " : "❌ "}{status.msg}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", margin: "0" }} />

        {/* Collaborators List */}
        <div style={{ ...s.section, flex: 1, overflowY: "auto" }}>
          <p style={s.sectionLabel}>
            CURRENT ACCESS {!loading && `· ${collaborators.length} member${collaborators.length !== 1 ? "s" : ""}`}
          </p>

          {loading ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 14 }}>
              Loading…
            </div>
          ) : collaborators.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                {isOwner ? "No collaborators yet. Invite someone above." : "No collaborators added."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {collaborators.map((c) => {
                const roleInfo = ROLES.find((r) => r.value === c.role) || ROLES[1];
                const initials = (c.name || c.email || "?").substring(0, 2).toUpperCase();
                return (
                  <div key={c.id} style={s.collabRow}>
                    <div style={s.avatar}>{initials}</div>
                    <div style={s.collabInfo}>
                      <span style={s.collabName}>{c.name || c.email}</span>
                      {c.name && <span style={s.collabEmail}>{c.email}</span>}
                    </div>
                    <span style={s.roleBadge(roleInfo)}>{roleInfo.label}</span>
                    {isOwner && (
                      <button
                        style={s.removeBtn}
                        onClick={() => remove(c.id, c.name || c.email)}
                        title="Remove access"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(10,22,40,0.45)",
    display: "flex",
    justifyContent: "flex-end",
    zIndex: 1000,
    backdropFilter: "blur(2px)",
  },
  panel: {
    background: "#fff",
    width: 420,
    height: "100%",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-8px 0 40px rgba(15,35,68,0.15)",
    animation: "slideIn 0.22s cubic-bezier(0.4,0,0.2,1)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "28px 28px 20px",
    borderBottom: "1px solid var(--border)",
  },
  badge: {
    display: "inline-block",
    background: "rgba(15,35,68,0.06)",
    color: "var(--navy)",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    padding: "4px 10px",
    borderRadius: 100,
    marginBottom: 10,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "var(--font-display)",
    color: "var(--navy)",
    letterSpacing: "-0.3px",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "var(--text-muted)",
    wordBreak: "break-all",
  },
  closeBtn: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "50%",
    width: 32, height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    cursor: "pointer",
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  section: { padding: "20px 28px" },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1.2px",
    color: "var(--text-light)",
    margin: "0 0 14px",
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    padding: "11px 14px",
    border: "1.5px solid var(--border)",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "var(--font-body)",
    color: "var(--text)",
    background: "var(--bg)",
    outline: "none",
    marginBottom: 12,
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  roleGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 14,
  },
  roleCard: (active, r) => ({
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 14px",
    border: `1.5px solid ${active ? "var(--navy)" : "var(--border)"}`,
    borderRadius: 10,
    cursor: "pointer",
    background: active ? "rgba(15,35,68,0.04)" : "white",
    transition: "all 0.18s",
  }),
  roleRadio: (active) => ({
    width: 14, height: 14,
    borderRadius: "50%",
    border: `2px solid ${active ? "var(--navy)" : "var(--border-dark)"}`,
    background: active ? "var(--navy)" : "transparent",
    flexShrink: 0,
    marginTop: 2,
    transition: "all 0.18s",
  }),
  inviteBtn: {
    width: "100%",
    padding: "11px 20px",
    background: "var(--navy)",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontFamily: "var(--font-body)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  collabRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 10,
    background: "var(--bg)",
    border: "1px solid var(--border)",
  },
  avatar: {
    width: 36, height: 36,
    borderRadius: "50%",
    background: "var(--navy)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 12,
    flexShrink: 0,
    fontFamily: "var(--font-body)",
  },
  collabInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  collabName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  collabEmail: {
    fontSize: 11,
    color: "var(--text-light)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  roleBadge: (r) => ({
    padding: "3px 10px",
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 700,
    background: r.bg,
    color: r.color,
    border: `1px solid ${r.border}`,
    whiteSpace: "nowrap",
    flexShrink: 0,
  }),
  removeBtn: {
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "50%",
    width: 26, height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-light)",
    cursor: "pointer",
    fontSize: 11,
    flexShrink: 0,
    transition: "all 0.18s",
  },
};
