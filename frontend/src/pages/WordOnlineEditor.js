import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import axios from "axios";

// ==============================
// WordOnlineEditor
//
// Critical: Word Online requires the HOST PAGE to send
// Host_PostmessageReady via postMessage to the iframe.
// Without this, Word Online never activates edit mode
// regardless of what CheckFileInfo returns.
//
// WOPI PostMessage protocol flow:
// 1. iframe loads Word Online
// 2. Host page sends Host_PostmessageReady → iframe
// 3. Word Online activates edit mode
// 4. Word Online sends App_LoadingStatus → host page
// 5. Host page handles UI_Edit, File_Save etc.
// ==============================

const WORD_ONLINE_ORIGIN_PATTERNS = [
  "officeapps.live.com",
  "microsoft.com",
  "microsoftonline.com",
];

function WordOnlineEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [editorUrl, setEditorUrl] = useState(null);
  const [meta, setMeta]           = useState(null);
  const [error, setError]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [status, setStatus]       = useState("Connecting to Word 365…");

  const iframeRef  = useRef(null);
  const readyRef   = useRef(false); // track if we've sent Host_PostmessageReady

  // ── Load WOPI token & build editor URL ───────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }

      try {
        const res = await axios.post(
          `http://localhost:5001/api/wopi/token/${id}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const url = res.data.word_online_url;

        // Detect localhost — ngrok not configured yet
        if (
          !url ||
          url.includes("WOPISrc=http%3A%2F%2Flocalhost") ||
          url.includes("WOPISrc=http%3A%2F%2F127")
        ) {
          setError("localhost");
        } else {
          setEditorUrl(url);
          setMeta(res.data);
        }
      } catch (err) {
        setError("failed");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [id, navigate]);

  // ── WOPI PostMessage Protocol ─────────────────────────────────────────────
  // This is THE critical piece. Without this, Word Online stays in view mode.
  useEffect(() => {
    if (!editorUrl) return;

    const isWordOnlineOrigin = (origin) =>
      WORD_ONLINE_ORIGIN_PATTERNS.some((p) => origin.includes(p));

    const sendToFrame = (messageObj) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify(messageObj),
          "*"   // Word Online is cross-origin; use "*" as target
        );
      } catch (e) {
        console.warn("postMessage to iframe failed:", e);
      }
    };

    // ── Handle incoming messages from Word Online ─────────────────────────
    const handleMessage = (event) => {
      // Accept messages from Word Online domains
      if (!isWordOnlineOrigin(event.origin)) return;

      let msg;
      try {
        msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      const msgId = msg?.MessageId || msg?.id;

      switch (msgId) {

        // Word Online signals it has loaded and is ready
        case "App_LoadingStatus":
          setStatus("Word 365 loaded");
          // If we haven't sent Host_PostmessageReady yet, send it now
          if (!readyRef.current) {
            readyRef.current = true;
            sendToFrame({
              MessageId: "Host_PostmessageReady",
              SendTime:  Date.now(),
              Values:    {}
            });
          }
          break;

        // Word Online requests edit mode activation
        case "UI_Edit":
          sendToFrame({
            MessageId: "Host_PostmessageReady",
            SendTime:  Date.now(),
            Values:    {}
          });
          break;

        // Word Online signals a save completed
        case "File_Saved":
        case "Doc_Save":
          setStatus("Saved ✓");
          setTimeout(() => setStatus(""), 3000);
          break;

        // Word Online signals it's closing
        case "App_PopState":
        case "UI_Close":
          navigate(-1);
          break;

        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [editorUrl, navigate]);

  // ── Send Host_PostmessageReady when iframe finishes loading ───────────────
  // This is the PRIMARY trigger. We send it as soon as the iframe
  // reports onLoad — Word Online checks for this message on startup.
  const handleIframeLoad = () => {
    if (readyRef.current) return;
    readyRef.current = true;

    setStatus("Activating edit mode…");

    // Small delay to let Word Online's JS initialise before we post
    setTimeout(() => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({
            MessageId: "Host_PostmessageReady",
            SendTime:  Date.now(),
            Values:    {}
          }),
          "*"
        );
        setStatus("Edit mode active");
        setTimeout(() => setStatus(""), 3000);
      } catch (e) {
        console.warn("Host_PostmessageReady failed:", e);
      }
    }, 800);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={s.center}>
        <div style={s.spinner} />
        <p style={s.loadingText}>Connecting to Word 365…</p>
      </div>
    );
  }

  if (error === "localhost") {
    return (
      <div style={s.center}>
        <div style={s.errorBox}>
          <div style={{ fontSize: "48px", textAlign: "center", marginBottom: "12px" }}>☁️</div>
          <h3 style={s.errorTitle}>One-time ngrok setup needed</h3>
          <p style={s.errorText}>
            Word 365 Online needs a public HTTPS URL to reach your server.
            Set up ngrok (free, 2 minutes) and it works exactly like LibreOffice.
          </p>

          <div style={s.stepsBox}>
            <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: "14px" }}>
              Setup steps (do once):
            </p>

            {[
              <>Download ngrok from <a href="https://ngrok.com/download" target="_blank" rel="noreferrer" style={s.link}>ngrok.com/download</a> and sign up for a free account.</>,
              <>Open a new terminal and run: <code style={s.code}>ngrok http 5001</code></>,
              <>Copy the <strong>https://</strong> URL ngrok gives you (e.g. <code style={s.inlineCode}>https://abc123.ngrok-free.app</code>)</>,
              <>Update <code style={s.inlineCode}>backend/.env</code>: <code style={s.code}>BACKEND_URL=https://abc123.ngrok-free.app</code></>,
              <>Update <code style={s.inlineCode}>docker-compose.yml</code>: <code style={s.code}>aliasgroup1: "https://abc123.ngrok-free.app"</code></>,
              <>Restart Flask and Collabora, then try again. ✅</>,
            ].map((step, i) => (
              <div key={i} style={s.step}>
                <span style={s.stepNum}>{i + 1}</span>
                <p style={{ margin: 0, fontSize: "13px", color: "#444", lineHeight: 1.5 }}>{step}</p>
              </div>
            ))}
          </div>

          <p style={s.noteText}>
            💡 Free ngrok gives a new URL each session. Get a fixed domain free at
            dashboard.ngrok.com → Domains → Create Domain, then use:
            <code style={s.code}>ngrok http --domain=your-domain.ngrok-free.app 5001</code>
          </p>

          <div style={s.errorActions}>
            <button style={s.btnSecondary} onClick={() => navigate(-1)}>← Back</button>
            <button style={s.btnPrimary} onClick={() => navigate(`/editor/${id}`)}>
              Open in LibreOffice Instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={s.center}>
        <div style={{ ...s.errorBox, maxWidth: "420px" }}>
          <h3 style={{ color: "#c0392b", margin: "0 0 12px" }}>⚠️ Failed to load</h3>
          <p style={{ color: "#555", fontSize: "14px" }}>
            Could not connect to Word Online. Make sure Flask is running and ngrok is active.
          </p>
          <button style={{ ...s.btnSecondary, marginTop: "16px" }} onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── Full-screen editor ────────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <button style={s.backBtn} onClick={() => navigate(-1)}>← Back</button>

        <div style={s.titleArea}>
          <div style={s.wIcon}>W</div>
          <span style={s.docName}>{meta?.manuscript_name}</span>
          <span style={s.badge(meta?.can_write ? "#1a3a5a" : "#3a2a10", meta?.can_write ? "#60a5fa" : "#fbbf24")}>
            {meta?.can_write ? "Word 365 — Edit Mode" : "Word 365 — View Only"}
          </span>
          {status && <span style={s.statusText}>{status}</span>}
        </div>

        <div style={s.toolbarRight}>
          <button style={s.switchBtn} onClick={() => navigate(`/editor/${id}`)}>
            Switch to LibreOffice
          </button>
        </div>
      </div>

      {/* Word Online iframe */}
      <iframe
        ref={iframeRef}
        src={editorUrl}
        style={s.iframe}
        title={`Word 365: ${meta?.manuscript_name}`}
        onLoad={handleIframeLoad}
        allow="clipboard-read; clipboard-write; fullscreen"
        allowFullScreen
      />

    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    background: "#1a3a6a",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 16px",
    background: "#1a3a6a",
    borderBottom: "2px solid #2a5a9a",
    minHeight: "52px",
    flexShrink: 0,
  },
  backBtn: {
    background: "transparent",
    border: "1px solid #3a6a9a",
    color: "#a0c0e0",
    padding: "6px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  titleArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    overflow: "hidden",
  },
  wIcon: {
    background: "#2b5eb7",
    color: "#fff",
    fontWeight: 900,
    fontSize: "15px",
    width: "30px",
    height: "30px",
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  docName: {
    color: "#e0f0ff",
    fontWeight: 600,
    fontSize: "15px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  badge: (bg, color) => ({
    padding: "2px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: bg,
    color: color,
    border: `1px solid ${color}50`,
    flexShrink: 0,
  }),
  statusText: {
    fontSize: "12px",
    color: "#80d0a0",
    fontStyle: "italic",
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  switchBtn: {
    background: "#0f2540",
    border: "1px solid #3a6a9a",
    color: "#a0c0e0",
    padding: "7px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  iframe: {
    flex: 1,
    border: "none",
    width: "100%",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#f5f5f5",
    padding: "20px",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #e0e0e0",
    borderTop: "4px solid #2b5eb7",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    marginTop: "16px",
    color: "#666",
    fontSize: "15px",
  },
  errorBox: {
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: "16px",
    padding: "32px",
    maxWidth: "620px",
    width: "100%",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  errorTitle: {
    margin: "0 0 12px",
    fontSize: "20px",
    fontWeight: 700,
    color: "#1a1a2e",
    textAlign: "center",
  },
  errorText: {
    fontSize: "14px",
    color: "#555",
    lineHeight: 1.6,
    marginBottom: "20px",
    textAlign: "center",
  },
  stepsBox: {
    background: "#f8f8f8",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  step: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  stepNum: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    background: "#2b5eb7",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "12px",
    flexShrink: 0,
    marginTop: "1px",
  },
  code: {
    display: "block",
    background: "#1e1e2e",
    color: "#a0f0a0",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    fontFamily: "monospace",
    marginTop: "6px",
    wordBreak: "break-all",
  },
  inlineCode: {
    background: "#eee",
    padding: "1px 6px",
    borderRadius: "4px",
    fontSize: "12px",
    fontFamily: "monospace",
    color: "#333",
  },
  noteText: {
    fontSize: "12px",
    color: "#888",
    lineHeight: 1.6,
    marginBottom: "20px",
    background: "#fffdf0",
    border: "1px solid #f0e060",
    borderRadius: "8px",
    padding: "10px 14px",
  },
  link: { color: "#2b5eb7", textDecoration: "underline" },
  errorActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  btnPrimary: {
    background: "#2b5eb7",
    color: "#fff",
    border: "none",
    padding: "9px 20px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
  },
  btnSecondary: {
    background: "#f5f5f5",
    color: "#555",
    border: "1px solid #ddd",
    padding: "9px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },
};

export default WordOnlineEditor;
