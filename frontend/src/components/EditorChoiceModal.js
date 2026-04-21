import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const EDITORS = [
  {
    id: "collabora",
    icon: "📝",
    name: "LibreOffice Editor",
    badge: "Recommended",
    badgeColor: "#1a4a2e",
    badgeText: "#4ade80",
    desc: "Full browser editor. Track changes, comments, real-time collaboration. No account needed.",
    works: "Works right now",
    worksColor: "#4ade80",
  },
  {
    id: "word-online",
    icon: "W",
    name: "Word 365 Online",
    badge: "Browser — No Desktop Needed",
    badgeColor: "#1a2e5a",
    badgeText: "#60a5fa",
    desc: "Open and edit in real Microsoft Word 365 in your browser. Free ngrok setup for local dev, works natively in production.",
    works: "Works with ngrok or on live server",
    worksColor: "#60a5fa",
  },
  {
    id: "word-desktop",
    icon: "🖥️",
    name: "Microsoft Word Desktop",
    badge: "Desktop App",
    badgeColor: "#2a2a2a",
    badgeText: "#aaaaaa",
    desc: "Download and open in your installed Word app. Re-upload when done.",
    works: "Works right now",
    worksColor: "#4ade80",
  },
];

const WORD_VERSIONS = [
  { id: "365",  label: "Word 365 / 2021 / 2019", desc: "Fully supported", icon: "✅", supported: true },
  { id: "old",  label: "Word 2016 or older",      desc: "Not supported — use an alternative", icon: "⚠️", supported: false },
  { id: "none", label: "Word is not installed",   desc: "Use an alternative below", icon: "❌", supported: false },
];

function EditorChoiceModal({ manuscriptId, manuscriptName, onClose, onOpenCollabora }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [screen, setScreen] = useState("main");
  const [error, setError] = useState(null);

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleSelect = async (editorId) => {
    setError(null);
    setLoading(editorId);

    try {
      if (editorId === "collabora") {
        await axios.post(`http://localhost:5001/api/wopi/token/${manuscriptId}`, {}, { headers });
        onClose();
        onOpenCollabora();

      } else if (editorId === "word-online") {
        onClose();
        navigate(`/word-editor/${manuscriptId}`);

      } else if (editorId === "word-desktop") {
        setScreen("version-check");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(null);
    }
  };

  const handleVersionSelect = async (versionId) => {
    if (versionId !== "365") { setScreen("old-word"); return; }

    setScreen("downloading");
    try {
      const res = await axios.get(
        `http://localhost:5001/api/manuscripts/download/${manuscriptId}`,
        { headers, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", manuscriptName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Please try again.");
      setScreen("version-check");
    }
  };

  // ── Version check screen ──────────────────────────────────────────────────
  if (screen === "version-check") {
    return (
      <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={s.modal}>
          <div style={s.header}>
            <div>
              <h3 style={s.title}>🖥️ Word Desktop</h3>
              <p style={s.subtitle}>Which Word version is installed?</p>
            </div>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div style={s.listCards}>
            {WORD_VERSIONS.map((v) => (
              <div key={v.id} style={s.listCard(v.supported)} onClick={() => handleVersionSelect(v.id)}>
                <span style={{ fontSize: "20px", flexShrink: 0 }}>{v.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={s.listCardTitle}>{v.label}</p>
                  <p style={s.listCardDesc(v.supported)}>{v.desc}</p>
                </div>
                <span style={s.arrowTxt}>→</span>
              </div>
            ))}
          </div>
          <button style={{ ...s.btnSecondary, marginTop: "16px" }} onClick={() => setScreen("main")}>← Back</button>
        </div>
      </div>
    );
  }

  // ── Downloading screen ────────────────────────────────────────────────────
  if (screen === "downloading") {
    return (
      <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={s.modal}>
          <div style={s.centerContent}>
            <div style={{ fontSize: "52px", marginBottom: "12px" }}>📥</div>
            <h3 style={{ margin: "0 0 12px", color: "#1a1a2e" }}>File Downloaded!</h3>
            <p style={{ fontSize: "14px", color: "#555", marginBottom: "20px" }}>
              Your file is in your <strong>Downloads folder</strong>.
            </p>
            <div style={s.stepsBox}>
              {["Open your Downloads folder", "Right-click → Open with → Word", "Edit, save, then re-upload here"].map((step, i) => (
                <div key={i} style={s.step}>
                  <span style={s.stepNum}>{i + 1}</span>
                  <span style={{ fontSize: "14px", color: "#333" }}>{step}</span>
                </div>
              ))}
            </div>
            {error && <p style={{ color: "#c0392b", fontSize: "13px" }}>{error}</p>}
            <button style={s.btnPrimary} onClick={onClose}>Got it</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Old Word / not installed screen ───────────────────────────────────────
  if (screen === "old-word") {
    return (
      <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={s.modal}>
          <div style={s.header}>
            <h3 style={s.title}>⚠️ Word Version Not Supported</h3>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
          <div style={s.warningBox}>
            <p style={s.warningText}>Word 2016 and older are not supported. Try one of these instead:</p>
          </div>
          <div style={{ ...s.listCards, marginTop: "14px" }}>
            <div style={s.listCard(true)} onClick={() => { onOpenCollabora(); onClose(); }}>
              <span style={{ fontSize: "22px" }}>📝</span>
              <div style={{ flex: 1 }}>
                <p style={s.listCardTitle}>LibreOffice Editor</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#555" }}>Full browser editor. Works right now, no account needed.</p>
              </div>
              <span style={s.arrowTxt}>→</span>
            </div>
            <div style={s.listCard(true)} onClick={() => { onClose(); navigate(`/word-editor/${manuscriptId}`); }}>
              <div style={{ width: "32px", height: "32px", background: "#dbeafe", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontWeight: 900, fontSize: "18px", color: "#2b5eb7" }}>W</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={s.listCardTitle}>Word 365 Online</p>
                <p style={{ margin: 0, fontSize: "12px", color: "#555" }}>Real Word 365 in your browser. Free with a Microsoft account.</p>
              </div>
              <span style={s.arrowTxt}>→</span>
            </div>
          </div>
          <button style={{ ...s.btnSecondary, marginTop: "16px" }} onClick={() => setScreen("version-check")}>← Back</button>
        </div>
      </div>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────
  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <h3 style={s.title}>Open in Editor</h3>
            <p style={s.subtitle}>{manuscriptName}</p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.listCards}>
          {EDITORS.map((editor) => (
            <div
              key={editor.id}
              style={s.editorCard(loading === editor.id)}
              onClick={() => !loading && handleSelect(editor.id)}
            >
              <div style={s.editorIconBox(editor.id)}>
                {editor.id === "word-online"
                  ? <span style={{ fontWeight: 900, fontSize: "22px", color: "#2b5eb7" }}>W</span>
                  : <span style={{ fontSize: "26px" }}>{editor.icon}</span>
                }
              </div>
              <div style={s.cardBody}>
                <div style={s.cardTitleRow}>
                  <span style={s.cardName}>{editor.name}</span>
                  <span style={s.badge(editor.badgeColor, editor.badgeText)}>{editor.badge}</span>
                </div>
                <p style={s.cardDesc}>{editor.desc}</p>
                <span style={{ fontSize: "12px", color: editor.worksColor, fontWeight: 600 }}>
                  ● {editor.works}
                </span>
              </div>
              <div style={s.arrowTxt}>{loading === editor.id ? "…" : "→"}</div>
            </div>
          ))}
        </div>

        {error && (
          <div style={s.errorBox}>
            <p style={{ margin: 0, fontSize: "13px", color: "#c0392b" }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#fff", borderRadius: "16px", padding: "28px", width: "540px", maxWidth: "95vw", boxShadow: "0 12px 48px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  title: { margin: 0, fontSize: "18px", fontWeight: 700, color: "#1a1a2e" },
  subtitle: { margin: "4px 0 0", fontSize: "12px", color: "#888" },
  closeBtn: { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#999", padding: "0 4px", flexShrink: 0 },
  listCards: { display: "flex", flexDirection: "column", gap: "10px" },
  editorCard: (active) => ({ display: "flex", alignItems: "center", gap: "14px", padding: "16px", borderRadius: "12px", border: `1px solid ${active ? "#6c63ff" : "#eee"}`, cursor: active ? "wait" : "pointer", background: active ? "#f8f7ff" : "#fafafa", transition: "border-color 0.15s" }),
  editorIconBox: (id) => ({ flexShrink: 0, width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", background: id === "word-online" ? "#dbeafe" : "#f0f0f8", borderRadius: "10px" }),
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" },
  cardName: { fontWeight: 700, fontSize: "15px", color: "#1a1a2e" },
  badge: (bg, color) => ({ padding: "2px 8px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, background: bg, color: color, whiteSpace: "nowrap" }),
  cardDesc: { margin: "0 0 4px", fontSize: "12px", color: "#666", lineHeight: 1.5 },
  arrowTxt: { fontSize: "18px", color: "#6c63ff", fontWeight: 700, flexShrink: 0 },
  listCard: (highlight) => ({ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", borderRadius: "10px", border: `1px solid ${highlight ? "#d0c8ff" : "#eee"}`, cursor: "pointer", background: highlight ? "#f8f7ff" : "#fafafa" }),
  listCardTitle: { margin: "0 0 2px", fontWeight: 700, fontSize: "14px", color: "#1a1a2e" },
  listCardDesc: (ok) => ({ margin: 0, fontSize: "12px", color: ok ? "#2d7a4f" : "#c0392b" }),
  centerContent: { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "8px 0" },
  stepsBox: { display: "flex", flexDirection: "column", gap: "12px", background: "#f8f8f8", borderRadius: "10px", padding: "16px", marginBottom: "20px", width: "100%", boxSizing: "border-box", textAlign: "left" },
  step: { display: "flex", alignItems: "center", gap: "12px" },
  stepNum: { width: "24px", height: "24px", borderRadius: "50%", background: "#6c63ff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px", flexShrink: 0 },
  warningBox: { background: "#fff8dc", border: "1px solid #f0c040", borderRadius: "10px", padding: "14px", marginBottom: "4px" },
  warningText: { margin: 0, fontSize: "13px", color: "#555", lineHeight: 1.6 },
  errorBox: { marginTop: "16px", background: "#fff0f0", border: "1px solid #f0c0c0", borderRadius: "8px", padding: "12px 16px" },
  btnPrimary: { background: "linear-gradient(135deg, #6c63ff, #9b59b6)", color: "#fff", border: "none", padding: "9px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "14px" },
  btnSecondary: { background: "#f5f5f5", color: "#555", border: "1px solid #ddd", padding: "9px 18px", borderRadius: "8px", cursor: "pointer", fontSize: "14px" },
};

export default EditorChoiceModal;
