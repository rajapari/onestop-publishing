function Landing() {
  return (
    <div className="landing">

      {/* Hero Section */}
      <div className="hero">

        <div className="hero-left">
          <h1 className="gradient-text">
            Future-Ready Publishing Platform
          </h1>

          <p className="hero-sub">
            Create, edit, validate, convert, and publish journals & books
            with AI-powered tools, XML workflows, and cloud repositories.
          </p>

          <div className="hero-buttons">
            <button className="btn-primary">
              Start Free
            </button>

            <button className="btn-outline">
              Watch Demo
            </button>
          </div>
        </div>


        {/* Feature Cards */}
        <div className="hero-right">

          <div className="feature-card">
            <div className="icon-circle">📘</div>
            <div>
              <strong>Multi-format Publishing</strong>
              <p>PDF, XML, EPUB, DOCX workflows</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="icon-circle">🧠</div>
            <div>
              <strong>AI Editing & NLP</strong>
              <p>Grammar, structure, & validation</p>
            </div>
          </div>

          <div className="feature-card">
            <div className="icon-circle">☁️</div>
            <div>
              <strong>Cloud Repository</strong>
              <p>Secure manuscript storage</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default Landing;