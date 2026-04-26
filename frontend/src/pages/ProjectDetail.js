import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import API_URL from "../config";
import CollaboratorsPanel from "../components/CollaboratorsPanel";
import EditorChoiceModal  from "../components/EditorChoiceModal";

// ── Helpers ───────────────────────────────────────────────────────────────────
function getExt(filename) {
  return filename?.split(".").pop()?.toLowerCase() || "";
}

function fileIcon(filename) {
  const ext = getExt(filename);
  const map = {
    docx:"📝", doc:"📝", odt:"📝",
    pdf:"📄",
    xlsx:"📊", xls:"📊", csv:"📊",
    pptx:"📊", ppt:"📊",
    png:"🖼️", jpg:"🖼️", jpeg:"🖼️", eps:"🖼️",
    zip:"📦", tex:"🔤", xml:"💻",
  };
  return map[ext] || "📎";
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const token        = localStorage.getItem("token");
  const headers      = { Authorization: `Bearer ${token}` };

  const [file,          setFile]          = useState([]);
  const [dragActive,    setDragActive]    = useState(false);
  const [files,         setFiles]         = useState({});
  const [uploading,     setUploading]     = useState(false);
  const [uploadStatus,  setUploadStatus]  = useState(null);
  const [editorTarget,  setEditorTarget]  = useState(null);
  const [collabTarget,  setCollabTarget]  = useState(null);
  const [snapStatus,    setSnapStatus]    = useState({});

  // ── Load files ─────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    if (!token) { navigate("/login"); return; }
    try {
      const res = await axios.get(`${API_URL}/api/manuscripts/${id}`, { headers });
      setFiles(res.data);
    } catch (err) { console.error("Load files error:", err); }
  }, [id]); // eslint-disable-line

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const uploadFile = async () => {
    if (!file || file.length === 0) {
      setUploadStatus({ type: "error", msg: "Please select files first." });
      return;
    }
    setUploading(true); setUploadStatus(null);
    try {
      for (let i = 0; i < file.length; i++) {
        const formData = new FormData();
        formData.append("file", file[i]);
        formData.append("project_id", id);
        await axios.post(`${API_URL}/api/manuscripts/upload`, formData, {
          headers: { ...headers, "Content-Type": "multipart/form-data" },
        });
      }
      setUploadStatus({ type: "success", msg: `${file.length} file(s) uploaded successfully.` });
      setFile([]);
      loadFiles();
    } catch {
      setUploadStatus({ type: "error", msg: "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const downloadFile = async (fileId, filename) => {
    try {
      const res = await axios.get(`${API_URL}/api/manuscripts/download/${fileId}`, {
        headers,
        responseType: "blob",
      });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.setAttribute("download", filename || "file");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch { alert("Download failed"); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteFile = async (fileId) => {
    if (!window.confirm("Delete this version?")) return;
    try {
      await axios.delete(`${API_URL}/api/manuscripts/${fileId}`, { headers });
      loadFiles();
    } catch { alert("Delete failed"); }
  };

  // ── Restore ────────────────────────────────────────────────────────────────
  const restoreFile = async (fileId) => {
    if (!window.confirm("Restore this version as the latest?")) return;
    try {
      await axios.post(`${API_URL}/api/manuscripts/restore/${fileId}`, {}, { headers });
      loadFiles();
    } catch { alert("Restore failed"); }
  };

  // ── Snapshot ───────────────────────────────────────────────────────────────
  const takeSnapshot = async (fileId, name) => {
    const label = window.prompt(
      `Name this snapshot of "${name}":`,
      `Snapshot ${new Date().toLocaleString()}`
    );
    if (!label) return;
    try {
      await axios.post(
        `${API_URL}/api/manuscripts/snapshot/${fileId}`,
        { label },
        { headers }
      );
      setSnapStatus((p) => ({ ...p, [name]: `✅ "${label}" saved` }));
      setTimeout(() => setSnapStatus((p) => ({ ...p, [name]: null })), 4000);
      loadFiles();
    } catch { alert("Snapshot failed"); }
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) setFile(e.dataTransfer.files);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-layout">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Navigation</div>
          <div className="sidebar-item" onClick={() => navigate("/dashboard")}>
            <span className="sidebar-icon">←</span> All Projects
          </div>
          <div className="sidebar-item active">
            <span className="sidebar-icon">📁</span> Project Files
          </div>
          <div className="sidebar-item" onClick={() => alert("Coming soon")}>
            <span className="sidebar-icon">👥</span> Collaborators
          </div>
          <div className="sidebar-item" onClick={() => alert("Coming soon")}>
            <span className="sidebar-icon">📊</span> Activity
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">

        <div className="page-header">
          <h1>Project #{id}</h1>
          <p>Upload, manage, and collaborate on your manuscripts.</p>
        </div>

        {/* Upload Card */}
        <div className="card">
          <div className="card-title">📤 Upload Files</div>

          <div
            className={`dropzone ${dragActive ? "active" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              onChange={(e) => setFile(e.target.files)}
              id="fileUpload"
              hidden
            />
            <label htmlFor="fileUpload" style={{ cursor: "pointer" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
              <p className="drop-title">Drag & Drop files here</p>
              <p className="drop-sub">or click to browse · DOCX, PDF, XML, EPUB supported</p>
            </label>
          </div>

          {file && file.length > 0 && (
            <div className="selected-files">
              {Array.from(file).map((f, i) => (
                <div key={i} className="file-chip">
                  {fileIcon(f.name)} {f.name}
                </div>
              ))}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={uploadFile}
            disabled={uploading}
            style={{ marginTop: 4 }}
          >
            {uploading ? "Uploading…" : "⬆ Upload Files"}
          </button>

          {uploadStatus && (
            <div
              className={uploadStatus.type === "success" ? "auth-success" : "auth-error"}
              style={{ marginTop: 12 }}
            >
              {uploadStatus.msg}
            </div>
          )}
        </div>

        {/* Files Card */}
        <div className="card">
          <div className="card-title">📄 Manuscript Files</div>

          {Object.keys(files).length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "40px 24px",
              color: "var(--text-muted)",
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p style={{ fontSize: 14 }}>No files uploaded yet. Upload your first manuscript above.</p>
            </div>
          ) : (
            Object.keys(files).map((name) => {
              const versions           = files[name];
              const latestNonSnapshot  = versions.find((f) => !f.is_snapshot);
              const editable           = versions[0]?.editable;

              return (
                <div key={name} className="file-group">

                  {/* File Header */}
                  <div style={s.fileHeader}>
                    <span style={s.fileName}>{fileIcon(name)} {name}</span>
                    <div style={s.fileHeaderActions}>
                      {snapStatus[name] && (
                        <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 500 }}>
                          {snapStatus[name]}
                        </span>
                      )}
                      {editable && latestNonSnapshot && (
                        <button
                          style={s.openInBtn}
                          onClick={() => setEditorTarget({
                            id: latestNonSnapshot.id,
                            name,
                            filename: latestNonSnapshot.filename,
                          })}
                        >
                          ✏️ Open In…
                        </button>
                      )}
                      <button
                        style={s.collabBtn}
                        onClick={() => setCollabTarget({ name })}
                      >
                        👥 Collaborators
                      </button>
                    </div>
                  </div>

                  {/* Version Rows */}
                  {versions.map((f) => (
                    <div
                      key={f.id}
                      className="file-row"
                      style={f.is_snapshot ? s.snapshotRow : undefined}
                    >
                      <div className="file-info">
                        {f.is_snapshot ? (
                          <span style={s.snapshotBadge}>📌 {f.snapshot_label || "Snapshot"}</span>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                            Version {f.version}
                          </span>
                        )}
                        <span className="file-date">
                          {new Date(f.last_modified || f.uploaded_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="file-actions">
                        <button onClick={() => downloadFile(f.id, name)}>⬇ Download</button>
                        {!f.is_snapshot && (
                          <>
                            <button onClick={() => restoreFile(f.id)}>🔄 Restore</button>
                            <button onClick={() => takeSnapshot(f.id, name)}>📌 Snapshot</button>
                          </>
                        )}
                        <button onClick={() => deleteFile(f.id)}>🗑 Delete</button>
                        <button
                          onClick={() => window.open(`${API_URL}/uploads/${f.filename}`, "_blank")}
                        >
                          👁 Preview
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Editor Choice Modal */}
      {editorTarget && (
        <EditorChoiceModal
          manuscriptId={editorTarget.id}
          manuscriptName={editorTarget.name}
          fileUrl={`${API_URL}/uploads/${editorTarget.filename}`}
          onClose={() => setEditorTarget(null)}
          onOpenCollabora={() => navigate(`/editor/${editorTarget.id}`)}
        />
      )}

      {/* Collaborators Panel */}
      {collabTarget && (
        <CollaboratorsPanel
          projectId={parseInt(id)}
          manuscriptName={collabTarget.name}
          isOwner={true}
          onClose={() => setCollabTarget(null)}
        />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  fileHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    padding: "14px 16px",
    background: "var(--bg)",
    borderBottom: "1px solid var(--border)",
  },
  fileName: {
    fontWeight: 700,
    fontSize: 14,
    color: "var(--navy)",
  },
  fileHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  openInBtn: {
    background: "var(--navy)",
    color: "#fff",
    border: "none",
    padding: "6px 14px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
    fontFamily: "var(--font-body)",
    whiteSpace: "nowrap",
  },
  collabBtn: {
    background: "white",
    color: "var(--navy)",
    border: "1px solid var(--border-dark)",
    padding: "5px 12px",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "var(--font-body)",
    whiteSpace: "nowrap",
  },
  snapshotRow: {
    background: "#FFFBEB",
    borderLeft: "3px solid #F59E0B",
  },
  snapshotBadge: {
    background: "#FEF3C7",
    color: "#92400E",
    padding: "2px 10px",
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #F59E0B",
  },
};
