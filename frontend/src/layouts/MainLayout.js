// MainLayout.js
// Thin wrapper used by pages that need a consistent content container.
// The topbar/navbar is handled globally in App.js.

export default function MainLayout({ children }) {
  return (
    <div style={{
      minHeight: "calc(100vh - 64px)",
      background: "var(--bg)",
    }}>
      {children}
    </div>
  );
}
