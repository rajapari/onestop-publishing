import { Link } from "react-router-dom";

const features = [
  {
    icon: "📘",
    title: "Multi-format Publishing",
    desc: "Export to PDF, EPUB, XML, DOCX — all from a single source manuscript.",
  },
  {
    icon: "🧠",
    title: "AI-Assisted Editing",
    desc: "Smart grammar, structure validation, and NLP-powered manuscript review.",
  },
  {
    icon: "☁️",
    title: "Cloud Repository",
    desc: "Version-controlled, secure manuscript storage with instant access.",
  },
  {
    icon: "👥",
    title: "Live Collaboration",
    desc: "Invite reviewers and editors with role-based access controls.",
  },
];

const stats = [
  { num: "12K+", label: "Manuscripts Published" },
  { num: "98%",  label: "Uptime Guaranteed" },
  { num: "140+", label: "Journals Supported" },
  { num: "4.9★", label: "User Rating" },
];

export default function Landing() {
  return (
    <div className="landing">

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-eyebrow">
            ✦ Trusted by Academic Publishers
          </div>

          <h1>
            Publish with<br />
            <em>scholarly</em> precision.
          </h1>

          <p>
            A unified platform for academic journals and book publishers —
            manuscript submission, peer review, XML workflows,
            and AI-powered editing in one place.
          </p>

          <div className="hero-buttons">
            <Link to="/signup" className="btn-primary">
              Start for free →
            </Link>
            <Link to="/login" className="btn-outline">
              Sign in
            </Link>
          </div>

          <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex" }}>
              {["#0F2344","#1B3A6B","#2563EB","#1D9E8C"].map((c, i) => (
                <div key={i} style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: c, border: "2px solid white",
                  marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i,
                  position: "relative",
                }} />
              ))}
            </div>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              <strong style={{ color: "var(--text)" }}>2,400+ publishers</strong> trust OneStop
            </span>
          </div>
        </div>

        <div className="hero-right">
          {features.map((f, i) => (
            <div className="feature-card" key={i}>
              <div className="feature-icon">{f.icon}</div>
              <div>
                <strong>{f.title}</strong>
                <p>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="stats-strip">
        <div className="stats-inner">
          {stats.map((s, i) => (
            <div key={i}>
              <div className="stat-num">{s.num}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "96px 48px",
        textAlign: "center",
      }}>
        <h2 style={{
          fontFamily: "var(--font-display)",
          fontSize: 38,
          fontWeight: 700,
          color: "var(--navy)",
          letterSpacing: "-0.5px",
          marginBottom: 16,
        }}>
          Ready to modernise your publishing workflow?
        </h2>
        <p style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 32, lineHeight: 1.7 }}>
          Join thousands of academic publishers who have streamlined their
          manuscript-to-publication journey with OneStop Publishing.
        </p>
        <Link to="/signup" className="btn-primary" style={{ fontSize: 16, padding: "14px 36px" }}>
          Get started free →
        </Link>
      </section>

    </div>
  );
}
