import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import API_URL from "../config";

export default function Editor() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [editorUrl,         setEditorUrl]         = useState(null);
  const [meta,              setMeta]              = useState(null);
  const [error,             setError]             = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [snapshotLabel,     setSnapshotLabel]     = useState("");
  const [snapshotStatus,    setSnapshotStatus]    = useState(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    const initEditor = async () => {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }
      try {
        const res = await axios.post(
          `${API_URL}/api/wopi/token/${id}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEditorUrl(res.data.editor_url);
        setMeta(res.data);
      } catch (err) {
        setError(
          err.response?.data?.error ||
          "Failed to load editor. Make sure Collabora Online is running."
        );
      } finally {
        setLoading(false);
      }
    };
    initEditor();
  }, [id, navigate]);

  const takeSnapshot = async () => {
    const token = localStorage.getItem("token");
    const label = snapshotLabel.trim() || `Snapshot ${new Date().toLocaleString()}`;
    try {
      await axios.post(
        `${API_URL}/api/manuscripts/snapshot/${id}`,
        { label },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSnapshotStatus("✅ Snapshot saved: " + label);
      setSnapshotLabel("");
      setShowSnapshotModal(false);
      setTimeout(() => setSnapshotStatus(null), 4000);
    } catch {
      setSnapshotStatus("❌ Snapshot failed");
      setTimeout(() => setSnapshotStatus(null), 3000);
    }
  };

  if (loading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading editor…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.center}>
        <div style={styles.errorBox}>
          <h3 style={{ margin: "0 0 12px", color: "#c0392b" }}>⚠️ Editor Unavailable</h3>
          <p style={{ margin: "0 0 16px", color: "#555" }}>{error}</p>
          <button style={styles.btnSecondary} onClick={() => navigate(-1)}>← Back to Project</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.editorPage}>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>← Back</button>

        <div style={styles.docTitle}>
          <span style={styles.docName}>{meta?.manuscript_name}</span>
          {meta?.can_write ? (
            <span style={styles.badge("editor")}>Editor</span>
          ) : (
            <span style={styles.badge("reviewer")}>Reviewer (Read-only)</span>
          )}
        </div>

        <div style={styles.toolbarRight}>
          {snapshotStatus && <span style={styles.snapshotStatus}>{snapshotStatus}</span>}
          {meta?.can_write && (
            <button style={styles.btnSnapshot} onClick={() => setShowSnapshotModal(true)}>
              📌 Save Snapshot
            </button>
          )}
        </div>
      </div>

      {/* Snapshot Modal */}
      {showSnapshotModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: "0 0 8px", color: "var(--navy)" }}>Save Named Snapshot</h3>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
              Creates a permanent copy of the current document state.
            </p>
            <input
              style={styles.input}
              type="text"
              placeholder={`e.g. "After Peer Review", "Final Draft"`}
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && takeSnapshot()}
              autoFocus
            />
            <div style={styles.modalActions}>
              <button style={styles.btnSecondary} onClick={() => setShowSnapshotModal(false)}>Cancel</button>
              <button style={styles.btnPrimary} onClick={takeSnapshot}>Save Snapshot</button>
            </div>
          </div>
        </div>
      )}

      {/* Collabora iframe */}
      <iframe
        ref={iframeRef}
        src={editorUrl}
        style={styles.iframe}
        title={`Editing: ${meta?.manuscript_name}`}
        allow="clipboard-read; clipboard-write; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

const styles = {
  editorPage:   { display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#1e1e2e" },
  toolbar:      { display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", background: "#16162a", borderBottom: "1px solid #2d2d4a", minHeight: 52, flexShrink: 0, zIndex: 10 },
  backBtn:      { background: "transparent", border: "1px solid #3d3d5c", color: "#a0a0c0", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" },
  docTitle:     { flex: 1, display: "flex", alignItems: "center", gap: 10, overflow: "hidden" },
  docName:      { color: "#e0e0f0", fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  badge:        (role) => ({ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: role === "editor" ? "#1a4a2e" : "#3a2a10", color: role === "editor" ? "#4ade80" : "#fbbf24", border: `1px solid ${role === "editor" ? "#2d7a4f" : "#92400e"}` }),
  toolbarRight: { display: "flex", alignItems: "center", gap: 10 },
  snapshotStatus: { fontSize: 13, color: "#a0e0a0" },
  btnSnapshot:  { background: "#2d2d4a", border: "1px solid #4a4a7a", color: "#c0c0e0", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" },
  iframe:       { flex: 1, border: "none", width: "100%" },
  center:       { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f5f5f5", padding: 20 },
  spinner:      { width: 40, height: 40, border: "4px solid #e0e0e0", borderTop: "4px solid #0F2344", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  loadingText:  { marginTop: 16, color: "#666", fontSize: 15 },
  errorBox:     { background: "#fff", border: "1px solid #f0c0c0", borderRadius: 12, padding: "28px 32px", maxWidth: 560, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal:        { background: "#fff", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.2)" },
  input:        { width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10 },
  btnPrimary:   { background: "#0F2344", color: "#fff", border: "none", padding: "9px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnSecondary: { background: "#f5f5f5", color: "#555", border: "1px solid #ddd", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
};
