import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import API_URL from "../config";

// ==============================
// OnlyOfficeEditor
//
// Flow:
// 1. Fetch config + OnlyOffice URL from backend (/api/onlyoffice/config/:id)
// 2. Dynamically load OnlyOffice API script from the OnlyOffice server
// 3. Create DocsAPI.DocEditor in the container div
// 4. OnlyOffice server fetches the file via TempDownloadToken
// 5. On save, OnlyOffice server POSTs to /api/onlyoffice/callback/:id
// ==============================

export default function OnlyOfficeEditor() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [config,            setConfig]            = useState(null);
  const [onlyOfficeUrl,     setOnlyOfficeUrl]      = useState(null);
  const [meta,              setMeta]              = useState(null);
  const [error,             setError]             = useState(null);
  const [loading,           setLoading]           = useState(true);
  const [status,            setStatus]            = useState("");
  const [snapshotLabel,     setSnapshotLabel]     = useState("");
  const [snapshotStatus,    setSnapshotStatus]    = useState(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  const editorRef    = useRef(null);   // DocsAPI.DocEditor instance
  const containerRef = useRef(null);   // div where editor mounts

  // ── Fetch config from backend ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }

      try {
        const res = await axios.post(
          `${API_URL}/api/onlyoffice/config/${id}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setConfig(res.data.config);
        setOnlyOfficeUrl(res.data.onlyoffice_url);
        setMeta(res.data);
      } catch (err) {
        const msg = err.response?.data?.error || "failed";
        setError(msg === "Manuscript not found" ? "not_found" : "failed");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, navigate]);

  // ── Load OnlyOffice script and mount editor ───────────────────────────────
  useEffect(() => {
    if (!config || !onlyOfficeUrl) return;

    const scriptSrc = `${onlyOfficeUrl}/web-apps/apps/api/documents/api.js`;

    // Remove any previously injected script to allow re-mount
    const existing = document.getElementById("onlyoffice-api-script");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id  = "onlyoffice-api-script";
    script.src = scriptSrc;
    script.async = true;

    script.onload = () => {
      if (!window.DocsAPI) {
        setError("api_missing");
        return;
      }
      if (editorRef.current) {
        try { editorRef.current.destroyEditor(); } catch {}
      }

      editorRef.current = new window.DocsAPI.DocEditor("onlyoffice-container", {
        ...config,
        events: {
          onDocumentReady: () => {
            setStatus("Ready");
            setTimeout(() => setStatus(""), 2000);
          },
          onDocumentStateChange: (event) => {
            setStatus(event.data ? "Unsaved changes…" : "");
          },
          onRequestClose: () => navigate(-1),
          onError: (event) => {
            console.error("[OnlyOffice] Error:", event.data);
            setStatus("⚠️ Editor error");
          },
        },
      });
    };

    script.onerror = () => setError("script_failed");

    document.head.appendChild(script);

    return () => {
      if (editorRef.current) {
        try { editorRef.current.destroyEditor(); } catch {}
        editorRef.current = null;
      }
    };
  }, [config, onlyOfficeUrl, navigate]);

  // ── Snapshot ──────────────────────────────────────────────────────────────
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

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.center}>
        <div style={s.ooIcon}>OO</div>
        <div style={s.spinner} />
        <p style={s.loadingText}>Connecting to OnlyOffice…</p>
        <p style={s.loadingSubtext}>Preparing your document</p>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  // ── Error: OnlyOffice not configured ─────────────────────────────────────
  if (error === "failed" || error === "script_failed" || error === "api_missing") {
    return (
      <div style={s.center}>
        <div style={s.errorBox}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🖊️</div>
            <div style={s.errorBadge}>Setup Required</div>
            <h3 style={s.errorTitle}>OnlyOffice is not running</h3>
            <p style={s.errorText}>
              OnlyOffice Document Server needs to be deployed as a separate service.
              Follow the steps below to set it up on Railway.
            </p>
          </div>

          <div style={s.stepsBox}>
            <p style={s.stepsTitle}>Railway Setup Steps</p>
            {[
              <>In Railway, click <strong>+ New Service → Docker Image</strong> and enter: <code style={s.inlineCode}>onlyoffice/documentserver</code></>,
              <>Add environment variables to that service: <code style={s.code}>JWT_ENABLED=true{"\n"}JWT_SECRET=your_secret_here</code></>,
              <>Copy the OnlyOffice service URL (e.g. <code style={s.inlineCode}>https://onlyoffice-xxxx.up.railway.app</code>)</>,
              <>Add to your <strong>backend</strong> Railway service variables: <code style={s.code}>ONLYOFFICE_URL=https://onlyoffice-xxxx.up.railway.app{"\n"}ONLYOFFICE_JWT_SECRET=your_secret_here</code></>,
              <>Redeploy your backend and try again ✅</>,
            ].map((step, i) => (
              <div key={i} style={s.step}>
                <span style={s.stepNum}>{i + 1}</span>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{step}</p>
              </div>
            ))}
          </div>

          <div style={s.noteBox}>
            <strong>💡 Note:</strong> OnlyOffice Document Server is free and open-source.
            The Railway Docker service uses about 1–2 GB RAM so check your Railway plan limits.
          </div>

          <div style={s.errorActions}>
            <button style={s.btnSecondary} onClick={() => navigate(-1)}>← Back</button>
            <button style={s.btnOutline} onClick={() => navigate(`/word-editor/${id}`)}>
              W Use Word 365
            </button>
            <button style={s.btnPrimary} onClick={() => navigate(`/editor/${id}`)}>
              📝 Open in LibreOffice
            </button>
          </div>
        </div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  // ── Error: not found ──────────────────────────────────────────────────────
  if (error === "not_found") {
    return (
      <div style={s.center}>
        <div style={{ ...s.errorBox, maxWidth: 440, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
          <h3 style={s.errorTitle}>Manuscript not found</h3>
          <p style={s.errorText}>This document may have been deleted or you don't have access.</p>
          <button style={{ ...s.btnSecondary, marginTop: 20 }} onClick={() => navigate(-1)}>← Back</button>
        </div>
      </div>
    );
  }

  // ── Full-screen Editor ────────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>← Back</button>

        <div style={s.titleArea}>
          <div style={s.ooIconSmall}>OO</div>
          <span style={s.docName}>{meta?.manuscript_name}</span>
          <span style={s.modeBadge(meta?.can_write)}>
            {meta?.can_write ? "Edit Mode" : "View Only"}
          </span>
          {status && <span style={s.statusText}>{status}</span>}
        </div>

        <div style={s.toolbarRight}>
          {snapshotStatus && <span style={s.snapshotFeedback}>{snapshotStatus}</span>}
          {meta?.can_write && (
            <button style={s.btnSnapshot} onClick={() => setShowSnapshotModal(true)}>
              📌 Save Snapshot
            </button>
          )}
          <button style={s.switchBtn} onClick={() => navigate(`/editor/${id}`)}>
            📝 LibreOffice
          </button>
          <button style={s.switchBtn} onClick={() => navigate(`/word-editor/${id}`)}>
            W Word 365
          </button>
        </div>
      </div>

      {/* Snapshot Modal */}
      {showSnapshotModal && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h3 style={{ margin: "0 0 8px", color: "var(--navy)" }}>Save Named Snapshot</h3>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>
              Creates a permanent copy of the current document state.
            </p>
            <input
              style={s.input}
              type="text"
              placeholder={`e.g. "After Peer Review", "Final Draft"`}
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && takeSnapshot()}
              autoFocus
            />
            <div style={s.modalActions}>
              <button style={s.btnSecondary} onClick={() => setShowSnapshotModal(false)}>Cancel</button>
              <button style={s.btnPrimary} onClick={takeSnapshot}>Save Snapshot</button>
            </div>
          </div>
        </div>
      )}

      {/* OnlyOffice mounts here */}
      <div
        id="onlyoffice-container"
        ref={containerRef}
        style={s.editorContainer}
      />

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    background: "#1B3A6B",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 16px",
    background: "#1B3A6B",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    minHeight: 52,
    flexShrink: 0,
    zIndex: 10,
  },
  backBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "rgba(255,255,255,0.7)",
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    whiteSpace: "nowrap",
    fontFamily: "var(--font-body)",
  },
  titleArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  ooIconSmall: {
    background: "#FF6B35",
    color: "#fff",
    fontWeight: 900,
    fontSize: 11,
    width: 30,
    height: 30,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    letterSpacing: "-0.5px",
  },
  docName: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: 600,
    fontSize: 14,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-body)",
  },
  modeBadge: (canWrite) => ({
    padding: "2px 10px",
    borderRadius: 100,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
    flexShrink: 0,
    background: canWrite ? "rgba(29,158,140,0.2)" : "rgba(201,150,26,0.2)",
    color:      canWrite ? "#26C4AE" : "#F5C842",
    border:     `1px solid ${canWrite ? "rgba(29,158,140,0.4)" : "rgba(201,150,26,0.4)"}`,
  }),
  statusText: {
    fontSize: 12,
    fontStyle: "italic",
    color: "rgba(255,255,255,0.6)",
    fontFamily: "var(--font-body)",
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  snapshotFeedback: {
    fontSize: 13,
    color: "#a0e0a0",
  },
  btnSnapshot: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "rgba(255,255,255,0.8)",
    padding: "7px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    whiteSpace: "nowrap",
    fontFamily: "var(--font-body)",
  },
  switchBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.65)",
    padding: "7px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    whiteSpace: "nowrap",
    fontFamily: "var(--font-body)",
  },
  editorContainer: {
    flex: 1,
    width: "100%",
    overflow: "hidden",
  },

  // Loading / error center
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "var(--bg)",
    padding: 24,
  },
  ooIcon: {
    width: 56,
    height: 56,
    background: "#FF6B35",
    color: "white",
    fontWeight: 900,
    fontSize: 18,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    letterSpacing: "-1px",
    fontFamily: "var(--font-body)",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid var(--border)",
    borderTop: "3px solid #FF6B35",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    marginBottom: 16,
  },
  loadingText: {
    fontFamily: "var(--font-display)",
    fontSize: 18,
    fontWeight: 700,
    color: "var(--navy)",
    margin: 0,
  },
  loadingSubtext: {
    fontSize: 13,
    color: "var(--text-muted)",
    marginTop: 6,
  },

  // Error box
  errorBox: {
    background: "white",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "32px 36px",
    maxWidth: 640,
    width: "100%",
    boxShadow: "var(--shadow-lg)",
  },
  errorBadge: {
    display: "inline-block",
    background: "#FFF7ED",
    color: "#9A3412",
    border: "1px solid #FDBA74",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    padding: "4px 12px",
    borderRadius: 100,
    marginBottom: 12,
  },
  errorTitle: {
    margin: "0 0 10px",
    fontSize: 22,
    fontWeight: 700,
    fontFamily: "var(--font-display)",
    color: "var(--navy)",
    letterSpacing: "-0.3px",
  },
  errorText: {
    fontSize: 14,
    color: "var(--text-muted)",
    lineHeight: 1.7,
    margin: "0 0 4px",
  },
  stepsBox: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  stepsTitle: {
    margin: "0 0 14px",
    fontWeight: 700,
    fontSize: 13,
    color: "var(--navy)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  step: { display: "flex", gap: 12, alignItems: "flex-start" },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#FF6B35",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 12,
    flexShrink: 0,
    marginTop: 2,
  },
  code: {
    display: "block",
    background: "#0F2344",
    color: "#26C4AE",
    padding: "8px 12px",
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "monospace",
    marginTop: 6,
    wordBreak: "break-all",
    whiteSpace: "pre",
  },
  inlineCode: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    padding: "1px 6px",
    borderRadius: 4,
    fontSize: 12,
    fontFamily: "monospace",
    color: "var(--navy)",
  },
  noteBox: {
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.7,
    marginBottom: 20,
    background: "#FFF7ED",
    border: "1px solid #FDBA74",
    borderRadius: 8,
    padding: "12px 16px",
  },
  errorActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  btnPrimary: {
    background: "var(--navy)",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    fontFamily: "var(--font-body)",
  },
  btnOutline: {
    background: "transparent",
    color: "#2B5EB7",
    border: "1px solid #2B5EB7",
    padding: "10px 18px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    fontFamily: "var(--font-body)",
  },
  btnSecondary: {
    background: "var(--bg)",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
    padding: "10px 18px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "var(--font-body)",
  },

  // Snapshot modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    padding: 28,
    width: 420,
    boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 16,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
};
