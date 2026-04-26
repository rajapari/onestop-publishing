import { Link, useLocation } from "react-router-dom";

const navItems = [
  { to: "/dashboard", icon: "📁", label: "Projects" },
  { to: "/settings",  icon: "⚙️", label: "Settings" },
];

export default function AppLayout({ children }) {
  const location = useLocation();

  return (
    <div style={s.app}>

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <span style={s.logoText}>OneStop</span>
          <span style={s.logoDot}>Publishing</span>
        </div>

        <nav style={s.nav}>
          <p style={s.navLabel}>Workspace</p>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={s.navItem(location.pathname === item.to)}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div style={s.main}>
        <div style={s.content}>{children}</div>
      </div>

    </div>
  );
}

const s = {
  app: {
    display: "flex",
    height: "100vh",
    fontFamily: "var(--font-body)",
    background: "var(--bg)",
  },
  sidebar: {
    width: 220,
    background: "white",
    borderRight: "1px solid var(--border)",
    padding: "24px 0",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  logo: {
    padding: "0 20px 24px",
    borderBottom: "1px solid var(--border)",
    marginBottom: 16,
  },
  logoText: {
    display: "block",
    fontFamily: "var(--font-display)",
    fontSize: 18,
    fontWeight: 700,
    color: "var(--navy)",
  },
  logoDot: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--gold)",
    letterSpacing: "0.5px",
  },
  nav: { padding: "0 10px" },
  navLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    color: "var(--text-light)",
    padding: "0 10px",
    margin: "0 0 6px",
  },
  navItem: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: active ? 600 : 500,
    color: active ? "var(--navy)" : "var(--text-muted)",
    background: active ? "rgba(15,35,68,0.07)" : "transparent",
    borderLeft: active ? "3px solid var(--navy)" : "3px solid transparent",
    marginBottom: 2,
    transition: "all 0.18s",
  }),
  main: {
    flex: 1,
    overflowY: "auto",
    background: "var(--bg)",
  },
  content: {
    padding: "32px 36px",
    maxWidth: 1000,
  },
};
