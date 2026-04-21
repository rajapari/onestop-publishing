import { useState, useEffect } from "react";
import axios from "axios";

// ==============================
// CollaboratorsPanel
// Props:
//   projectId      – number
//   manuscriptName – string (logical file name)
//   isOwner        – bool (only owner can add/remove)
//   onClose        – fn
// ==============================

const ROLES = [
  {
    value: "editor",
    label: "Editor",
    desc: "Can view and edit the document",
    color: "#4ade80",
    bg: "#1a4a2e",
  },
  {
    value: "reviewer",
    label: "Reviewer",
    desc: "Can view but not edit (read-only)",
    color: "#fbbf24",
    bg: "#3a2a10",
  },
];

function CollaboratorsPanel({ projectId, manuscriptName, isOwner, onClose }) {
  const [collaborators, setCollaborators] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("reviewer");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // ── Load collaborators ─────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:5001/api/collaborators/${projectId}/${encodeURIComponent(manuscriptName)}`,
        { headers }
      );
      setCollaborators(res.data);
    } catch (err) {
      console.error("Load collaborators error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId, manuscriptName]); // eslint-disable-line

  // ── Invite collaborator ────────────────────────────────────────────────
  const invite = async () => {
    if (!email.trim()) return;
    setAdding(true);
    setStatus(null);

    try {
      const res = await axios.post(
        `http://localhost:5001/api/collaborators/${projectId}/${encodeURIComponent(manuscriptName)}`,
        { email: email.trim().toLowerCase(), role },
        { headers }
      );
      setStatus({ type: "success", msg: res.data.message });
      setEmail("");
      load();
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to add collaborator";
      setStatus({ type: "error", msg });
    } finally {
      setAdding(false);
    }
  };

  // ── Remove collaborator ───────────────────────────────────────────────
  const remove = async (collabId, name) => {
    if (!window.confirm(`Remove ${name} from this document?`)) return;

    try {
      await axios.delete(
        `http://localhost:5001/api/collaborators/${collabId}`,
        { headers }
      );
      load();
    } catch (err) {
      console.error("Remove error:", err);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.panel}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <h3 style={s.title}>Collaborators</h3>
            <p style={s.subtitle}>{manuscriptName}</p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Invite form — owners only */}
        {isOwner && (
          <div style={s.inviteSection}>
            <p style={s.sectionLabel}>INVITE COLLABORATOR</p>

            <div style={s.inputRow}>
              <input
                style={s.input}
                type="email"
                placeholder="colleague@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
              />

              <select
                style={s.select}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>

              <button
                style={s.inviteBtn}
                onClick={invite}
                disabled={adding || !email.trim()}
              >
                {adding ? "…" : "Invite"}
              </button>
            </div>

            {/* Role descriptions */}
            <div style={s.roleHints}>
              {ROLES.map((r) => (
                <div key={r.value} style={s.roleHint(r.value === role)}>
                  <span style={{ ...s.roleDot, background: r.color }} />
                  <strong>{r.label}</strong>: {r.desc}
                </div>
              ))}
            </div>

            {status && (
              <p style={s.statusMsg(status.type)}>{status.msg}</p>
            )}
          </div>
        )}

        {/* Current collaborators */}
        <div style={s.listSection}>
          <p style={s.sectionLabel}>
            CURRENT COLLABORATORS {!loading && `(${collaborators.length})`}
          </p>

          {loading ? (
            <p style={s.emptyMsg}>Loading…</p>
          ) : collaborators.length === 0 ? (
            <p style={s.emptyMsg}>
              {isOwner
                ? "No collaborators yet. Invite someone above."
                : "No collaborators added to this document."}
            </p>
          ) : (
            <div style={s.list}>
              {collaborators.map((c) => {
                const roleInfo = ROLES.find((r) => r.value === c.role) || ROLES[1];
                return (
                  <div key={c.id} style={s.collabRow}>
                    <div style={s.avatar}>
                      {(c.name || c.email || "?").substring(0, 2).toUpperCase()}
                    </div>

                    <div style={s.collabInfo}>
                      <span style={s.collabName}>{c.name || c.email}</span>
                      {c.name && (
                        <span style={s.collabEmail}>{c.email}</span>
                      )}
                    </div>

                    <span style={s.roleBadge(roleInfo)}>
                      {roleInfo.label}
                    </span>

                    {isOwner && (
                      <button
                        style={s.removeBtn}
                        onClick={() => remove(c.id, c.name || c.email)}
                        title="Remove collaborator"
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

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  panel: {
    background: "#fff",
    width: "420px",
    height: "100%",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "24px 24px 16px",
    borderBottom: "1px solid #eee",
  },
  title: { margin: 0, fontSize: "18px", fontWeight: 700, color: "#1a1a2e" },
  subtitle: { margin: "4px 0 0", fontSize: "12px", color: "#888", wordBreak: "break-all" },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    color: "#999",
    padding: "0 4px",
  },
  inviteSection: {
    padding: "20px 24px",
    borderBottom: "1px solid #f0f0f0",
    background: "#fafafa",
  },
  sectionLabel: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "#aaa",
    margin: "0 0 10px",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "10px",
  },
  input: {
    flex: 1,
    padding: "9px 12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "13px",
    outline: "none",
    minWidth: 0,
  },
  select: {
    padding: "9px 10px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "13px",
    background: "#fff",
    cursor: "pointer",
  },
  inviteBtn: {
    background: "linear-gradient(135deg, #6c63ff, #9b59b6)",
    color: "#fff",
    border: "none",
    padding: "9px 16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  roleHints: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginBottom: "8px",
  },
  roleHint: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: active ? "#333" : "#aaa",
    padding: "4px 0",
  }),
  roleDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusMsg: (type) => ({
    marginTop: "8px",
    fontSize: "13px",
    color: type === "success" ? "#2d7a4f" : "#c0392b",
    fontWeight: 500,
  }),
  listSection: {
    padding: "20px 24px",
    flex: 1,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  collabRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "10px",
    background: "#f9f9f9",
    border: "1px solid #eee",
  },
  avatar: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6c63ff, #9b59b6)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "13px",
    flexShrink: 0,
  },
  collabInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  collabName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#222",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  collabEmail: {
    fontSize: "11px",
    color: "#999",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  roleBadge: (roleInfo) => ({
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 600,
    background: roleInfo.bg,
    color: roleInfo.color,
    whiteSpace: "nowrap",
    flexShrink: 0,
  }),
  removeBtn: {
    background: "none",
    border: "none",
    color: "#ccc",
    cursor: "pointer",
    fontSize: "14px",
    padding: "2px 4px",
    flexShrink: 0,
  },
  emptyMsg: {
    fontSize: "14px",
    color: "#aaa",
    fontStyle: "italic",
    margin: "8px 0 0",
  },
};

export default CollaboratorsPanel;
