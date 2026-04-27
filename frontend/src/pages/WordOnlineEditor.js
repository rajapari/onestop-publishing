import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import API_URL from "../config";

// ==============================
// WordOnlineEditor
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

export default function WordOnlineEditor() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [editorUrl, setEditorUrl] = useState(null);
  const [meta,      setMeta]      = useState(null);
  const [error,     setError]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [status,    setStatus]    = useState("Connecting to Word 365…");
  const [saved,     setSaved]     = useState(false);

  const iframeRef = useRef(null);
  const readyRef  = useRef(false);

  // ── Load WOPI token ───────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/login"); return; }

      try {
        const res = await axios.post(
          `${API_URL}/api/wopi/token/${id}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const url = res.data.word_online_url;

        // Detect if still pointing to localhost — ngrok not configured
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
      } catch {
        setError("failed");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [id, navigate]);

  // ── WOPI PostMessage Protocol ─────────────────────────────────────────────
  useEffect(() => {
    if (!editorUrl) return;

    const isWordOrigin = (origin) =>
      WORD_ONLINE_ORIGIN_PATTERNS.some((p) => origin.includes(p));

    const sendToFrame = (messageObj) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify(messageObj), "*"
        );
      } catch (e) {
        console.warn("postMessage to iframe failed:", e);
      }
    };

    const handleMessage = (event) => {
      if (!isWordOrigin(event.origin)) return;

      let msg;
      try {
        msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch { return; }

      const msgId = msg?.MessageId || msg?.id;

      switch (msgId) {
        case "App_LoadingStatus":
          setStatus("Word 365 loaded");
          if (!readyRef.current) {
            readyRef.current = true;
            sendToFrame({ MessageId: "Host_PostmessageReady", SendTime: Date.now(), Values: {} });
          }
          break;

        case "UI_Edit":
          sendToFrame({ MessageId: "Host_PostmessageReady", SendTime: Date.now(), Values: {} });
          break;

        case "File_Saved":
        case "Doc_Save":
          setStatus("Saved ✓");
          setSaved(true);
          setTimeout(() => { setStatus(""); setSaved(false); }, 3000);
          break;

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

  // ── Send Host_PostmessageReady on iframe load ─────────────────────────────
  const handleIframeLoad = () => {
    if (readyRef.current) return;
    readyRef.current = true;
    setStatus("Activating edit mode…");
    setTimeout(() => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ MessageId: "Host_PostmessageReady", SendTime: Date.now(), Values: {} }),
          "*"
        );
        setStatus("Edit mode active");
        setTimeout(() => setStatus(""), 3000);
      } catch (e) {
        console.warn("Host_PostmessageReady failed:", e);
      }
    }, 800);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.center}>
        <div style={s.wordIcon}>W</div>
        <div style={s.spinner} />
        <p style={s.loadingText}>Connecting to Word 365…</p>
        <p style={s.loadingSubtext}>Preparing your document</p>
      </div>
    );
  }

  // ── Localhost / ngrok error ───────────────────────────────────────────────
  if (error === "localhost") {
    return (
      <div style={s.center}>
        <div style={s.errorBox}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>☁️</div>
            <div style={s.errorBadge}>Setup Required</div>
            <h3 style={s.errorTitle}>One-time ngrok setup needed</h3>
            <p style={s.errorText}>
              Word 365 Online needs a public HTTPS URL to reach your server.
              Set up ngrok once (free, ~2 minutes) and it works exactly like LibreOffice.
            </p>
          </div>

          <div style={s.stepsBox}>
            <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 13, color: "var(--navy)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Setup Steps
            </p>
            {[
              <>Download ngrok from <a href="https://ngrok.com/download" target="_blank" rel="noreferrer" style={s.link}>ngrok.com/download</a> and sign up for a free account.</>,
              <>Open a new terminal and run: <code style={s.code}>ngrok http 5001</code></>,
              <>Copy the <strong>https://</strong> URL ngrok gives you (e.g. <code style={s.inlineCode}>https://abc123.ngrok-free.app</code>)</>,
              <>Update <code style={s.inlineCode}>backend/.env</code>: <code style={s.code}>BACKEND_URL=https://abc123.ngrok-free.app</code></>,
              <>Update <code style={s.inlineCode}>docker-compose.yml</code>: <code style={s.code}>aliasgroup1: "https://abc123.ngrok-free.app"</code></>,
              <>Restart Flask and Collabora, then try again ✅</>,
            ].map((step, i) => (
              <div key={i} style={s.step}>
                <span style={s.stepNum}>{i + 1}</span>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{step}</p>
              </div>
            ))}
          </div>

          <div style={s.noteBox}>
            <strong>💡 Tip:</strong> Free ngrok gives a new URL each session. Get a fixed free domain at
            dashboard.ngrok.com → Domains → Create Domain, then use:
            <code style={s.code}>ngrok http --domain=your-domain.ngrok-free.app 5001</code>
          </div>

          <div style={s.errorActions}>
            <button style={s.btnSecondary} onClick={() => navigate(-1)}>← Back</button>
            <button style={s.btnPrimary} onClick={() => navigate(`/editor/${id}`)}>
              📝 Open in LibreOffice Instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Generic error ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={s.center}>
        <div style={{ ...s.errorBox, maxWidth: 440, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h3 style={s.errorTitle}>Failed to load Word 365</h3>
          <p style={s.errorText}>
            Could not connect to Word Online. Make sure Flask is running and your backend URL is correct.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
            <button style={s.btnSecondary} onClick={() => navigate(-1)}>← Back</button>
            <button style={s.btnPrimary} onClick={() => navigate(`/editor/${id}`)}>
              📝 Use LibreOffice
            </button>
          </div>
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
          <div style={s.wIcon}>W</div>
          <span style={s.docName}>{meta?.manuscript_name}</span>
          <span style={s.modeBadge(meta?.can_write)}>
            {meta?.can_write ? "Edit Mode" : "View Only"}
          </span>
          {status && (
            <span style={{ ...s.statusText, color: saved ? "#4ade80" : "#93c5fd" }}>
              {status}
            </span>
          )}
        </div>

        <div style={s.toolbarRight}>
          <button style={s.switchBtn} onClick={() => navigate(`/editor/${id}`)}>
            📝 Switch to LibreOffice
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

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  // Full-screen editor
  page: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    background: "#0F2344",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 16px",
    background: "#0F2344",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    minHeight: 52,
    flexShrink: 0,
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
    transition: "all 0.18s",
  },
  titleArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
  },
  wIcon: {
    background: "#2B5EB7",
    color: "#fff",
    fontWeight: 900,
    fontSize: 15,
    width: 30,
    height: 30,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontFamily: "var(--font-body)",
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
    fontFamily: "var(--font-body)",
    transition: "color 0.3s",
  },
  toolbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  switchBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.75)",
    padding: "7px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    whiteSpace: "nowrap",
    fontFamily: "var(--font-body)",
    transition: "all 0.18s",
  },
  iframe: { flex: 1, border: "none", width: "100%" },

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
  wordIcon: {
    width: 56, height: 56,
    background: "#2B5EB7",
    color: "white",
    fontWeight: 900,
    fontSize: 28,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    fontFamily: "var(--font-body)",
  },
  spinner: {
    width: 36, height: 36,
    border: "3px solid var(--border)",
    borderTop: "3px solid #2B5EB7",
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
    maxWidth: 620,
    width: "100%",
    boxShadow: "var(--shadow-lg)",
  },
  errorBadge: {
    display: "inline-block",
    background: "#FEF3C7",
    color: "#92400E",
    border: "1px solid #FDE68A",
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
  step: { display: "flex", gap: 12, alignItems: "flex-start" },
  stepNum: {
    width: 24, height: 24,
    borderRadius: "50%",
    background: "var(--navy)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 12,
    flexShrink: 0,
    marginTop: 2,
    fontFamily: "var(--font-body)",
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
    background: "#FFFBEB",
    border: "1px solid #FDE68A",
    borderRadius: 8,
    padding: "12px 16px",
  },
  link: {
    color: "#2B5EB7",
    textDecoration: "underline",
    fontWeight: 600,
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
    transition: "background 0.2s",
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
};
