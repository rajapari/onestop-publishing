import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "../config";

const EDITORS = [
  {
    id: "collabora",
    icon: "📝",
    name: "LibreOffice Editor",
    badge: "Recommended",
    badgeColor: "#F0FDF4",
    badgeText: "#16A34A",
    badgeBorder: "#BBF7D0",
    desc: "Full browser editor with track changes, comments, and real-time collaboration. No account needed.",
    works: "Available now",
    worksColor: "#16A34A",
  },
  {
    id: "word-online",
    icon: "W",
    name: "Word 365 Online",
    badge: "Browser — No Desktop Needed",
    badgeColor: "#EFF6FF",
    badgeText: "#2563EB",
    badgeBorder: "#BFDBFE",
    desc: "Open and edit in real Microsoft Word 365 directly in your browser. Works natively in production.",
    works: "Available on live server",
    worksColor: "#2563EB",
  },
  {
    id: "word-desktop",
    icon: "🖥️",
    name: "Microsoft Word Desktop",
    badge: "Desktop App",
    badgeColor: "var(--bg)",
    badgeText: "var(--text-muted)",
    badgeBorder: "var(--border)",
    desc: "Download and open in your installed Word application. Re-upload when done.",
    works: "Available now",
    worksColor: "#16A34A",
  },
];

const WORD_VERSIONS = [
  { id: "365",  label: "Word 365 / 2021 / 2019", desc: "Fully supported",              icon: "✅", supported: true },
  { id: "old",  label: "Word 2016 or older",      desc: "Not supported — use alternative", icon: "⚠️", supported: false },
  { id: "none", label: "Word is not installed",   desc: "Use an alternative below",     icon: "❌", supported: false },
];

export default function EditorChoiceModal({ manuscriptId, manuscriptName, onClose, onOpenCollabora }) {
  const navigate   = useNavigate();
  const [loading,  setLoading]  = useState(null);
  const [screen,   setScreen]   = useState("main");
  const [error,    setError]    = useState(null);

  const token   = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleSelect = async (editorId) => {
    setError(null); setLoading(editorId);
    try {
      if (editorId === "collabora") {
        await axios.post(`${API_URL}/api/wopi/token/${manuscriptId}`, {}, { headers });
        onClose();
        onOpenCollabora();
      } else if (editorId === "word-online") {
        onClose();
        navigate(`/word-editor/${manuscriptId}`);
      } else if (editorId === "word-desktop") {
        setScreen("version-check");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleVersionSelect = async (versionId) => {
    if (versionId !== "365") { setScreen("old-word"); return; }
    setScreen("downloading");
    try {
      const res = await axios.get(
        `${API_URL}/api/manuscripts/download/${manuscriptId}`,
        { headers, responseType: "blob" }
      );
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href  = url;
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

  // ── Version Check ─────────────────────────────────────────────────────────
  if (screen === "version-check") {
    return (
      <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={s.modal}>
          <div style={s.header}>
            <div>
              <div style={s.badge}>Word Desktop</div>
              <h3 style={s.title}>Which version is installed?</h3>
            </div>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {WORD_VERSIONS.map((v) => (
              <div key={v.id} style={s.listCard(v.supported)} onClick={() => handleVersionSelect(v.id)}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{v.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={s.listCardTitle}>{v.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: v.supported ? "#16A34A" : "#DC2626" }}>{v.desc}</p>
                </div>
                <span style={s.arrow}>→</span>
              </div>
            ))}
          </div>

          <button style={s.backBtn} onClick={() => setScreen("main")}>← Back</button>
        </div>
      </div>
    );
  }

  // ── Downloading ───────────────────────────────────────────────────────────
  if (screen === "downloading") {
    return (
      <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={{ ...s.modal, textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📥</div>
          <h3 style={s.title}>File Downloaded!</h3>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "8px 0 24px", lineHeight: 1.6 }}>
            Your file is in your <strong>Downloads folder</strong>.
          </p>
          <div style={s.stepsBox}>
            {["Open your Downloads folder", "Right-click → Open with → Microsoft Word", "Edit, save, then re-upload here"].map((step, i) => (
              <div key={i} style={s.step}>
                <span style={s.stepNum}>{i + 1}</span>
                <span style={{ fontSize: 13, color: "var(--text)" }}>{step}</span>
              </div>
            ))}
          </div>
          {error && <p style={{ color: "#DC2626", fontSize: 13, marginBottom: 14 }}>{error}</p>}
          <button style={s.primaryBtn} onClick={onClose}>Got it, close →</button>
        </div>
      </div>
    );
  }

  // ── Old Word ──────────────────────────────────────────────────────────────
  if (screen === "old-word") {
    return (
      <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div style={s.modal}>
          <div style={s.header}>
            <div>
              <div style={{ ...s.badge, background: "#FEF2F2", color: "#DC2626" }}>Unsupported</div>
              <h3 style={s.title}>Word version not supported</h3>
            </div>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>

          <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#92400E", lineHeight: 1.6 }}>
              Word 2016 and older are not compatible with WOPI. Please use one of the alternatives below.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={s.listCard(true)} onClick={() => { onOpenCollabora(); onClose(); }}>
              <span style={{ fontSize: 24 }}>📝</span>
              <div style={{ flex: 1 }}>
                <p style={s.listCardTitle}>LibreOffice Editor</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Full browser editor. No account needed.</p>
              </div>
              <span style={s.arrow}>→</span>
            </div>
            <div style={s.listCard(true)} onClick={() => { onClose(); navigate(`/word-editor/${manuscriptId}`); }}>
              <div style={{ width: 36, height: 36, background: "#EFF6FF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontWeight: 900, fontSize: 20, color: "#2563EB" }}>W</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={s.listCardTitle}>Word 365 Online</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Real Word 365 in your browser. Free with a Microsoft account.</p>
              </div>
              <span style={s.arrow}>→</span>
            </div>
          </div>

          <button style={s.backBtn} onClick={() => setScreen("version-check")}>← Back</button>
        </div>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <div style={s.badge}>Open In</div>
            <h3 style={s.title}>Choose an Editor</h3>
            <p style={s.subtitle}>{manuscriptName}</p>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {EDITORS.map((editor) => (
            <div
              key={editor.id}
              style={s.editorCard(loading === editor.id)}
              onClick={() => !loading && handleSelect(editor.id)}
            >
              <div style={s.editorIcon(editor.id)}>
                {editor.id === "word-online"
                  ? <span style={{ fontWeight: 900, fontSize: 22, color: "#2563EB" }}>W</span>
                  : <span style={{ fontSize: 26 }}>{editor.icon}</span>
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={s.cardName}>{editor.name}</span>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 100,
                    fontSize: 10,
                    fontWeight: 700,
                    background: editor.badgeColor,
                    color: editor.badgeText,
                    border: `1px solid ${editor.badgeBorder}`,
                    whiteSpace: "nowrap",
                  }}>
                    {editor.badge}
                  </span>
                </div>
                <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {editor.desc}
                </p>
                <span style={{ fontSize: 12, color: editor.worksColor, fontWeight: 600 }}>
                  ● {editor.works}
                </span>
              </div>

              <span style={{ fontSize: 18, color: "var(--navy)", fontWeight: 700, flexShrink: 0 }}>
                {loading === editor.id ? "…" : "→"}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#DC2626" }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(10,22,40,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(3px)",
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: 28,
    width: 520,
    maxWidth: "95vw",
    boxShadow: "0 20px 60px rgba(15,35,68,0.2)",
    maxHeight: "90vh",
    overflowY: "auto",
    animation: "fadeUp 0.2s ease",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
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
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "var(--font-display)",
    color: "var(--navy)",
    letterSpacing: "-0.3px",
  },
  subtitle: { margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" },
  closeBtn: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "50%",
    width: 32, height: 32,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, cursor: "pointer",
    color: "var(--text-muted)", flexShrink: 0,
  },
  editorCard: (active) => ({
    display: "flex", alignItems: "center", gap: 14,
    padding: "16px 18px",
    borderRadius: 12,
    border: `1.5px solid ${active ? "var(--navy)" : "var(--border)"}`,
    cursor: active ? "wait" : "pointer",
    background: active ? "rgba(15,35,68,0.03)" : "var(--bg)",
    transition: "all 0.18s",
  }),
  editorIcon: (id) => ({
    flexShrink: 0, width: 48, height: 48,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: id === "word-online" ? "#EFF6FF" : "white",
    borderRadius: 10,
    border: "1px solid var(--border)",
  }),
  cardName: { fontWeight: 700, fontSize: 15, color: "var(--navy)" },
  arrow: { fontSize: 16, color: "var(--navy)", fontWeight: 700, flexShrink: 0 },
  listCard: (highlight) => ({
    display: "flex", alignItems: "center", gap: 12,
    padding: "14px 16px",
    borderRadius: 10,
    border: `1.5px solid ${highlight ? "var(--border-dark)" : "var(--border)"}`,
    cursor: "pointer",
    background: "var(--bg)",
    transition: "all 0.18s",
  }),
  listCardTitle: { margin: "0 0 2px", fontWeight: 700, fontSize: 14, color: "var(--navy)" },
  backBtn: {
    marginTop: 16,
    padding: "9px 18px",
    background: "var(--bg)",
    color: "var(--text-muted)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "var(--font-body)",
  },
  primaryBtn: {
    padding: "11px 24px",
    background: "var(--navy)",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
    fontFamily: "var(--font-body)",
  },
  stepsBox: {
    display: "flex", flexDirection: "column", gap: 12,
    background: "var(--bg)",
    borderRadius: 10, padding: 16, marginBottom: 20,
    width: "100%", boxSizing: "border-box", textAlign: "left",
    border: "1px solid var(--border)",
  },
  step: { display: "flex", alignItems: "center", gap: 12 },
  stepNum: {
    width: 24, height: 24, borderRadius: "50%",
    background: "var(--navy)", color: "white",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 12, flexShrink: 0,
  },
};
