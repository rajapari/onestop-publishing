import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import CollaboratorsPanel from "../components/CollaboratorsPanel";
import EditorChoiceModal from "../components/EditorChoiceModal";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getExt(filename) {
  return filename?.split(".").pop()?.toLowerCase() || "";
}

function fileIcon(filename) {
  const ext = getExt(filename);
  const map = {
    docx: "📝", doc: "📝", odt: "📝",
    pdf: "📄",
    xlsx: "📊", xls: "📊", csv: "📊",
    pptx: "📊", ppt: "📊",
    png: "🖼️", jpg: "🖼️", jpeg: "🖼️", eps: "🖼️",
    zip: "📦", tex: "🔤", xml: "💻",
  };
  return map[ext] || "📎";
}

// ── Component ─────────────────────────────────────────────────────────────────

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [file, setFile] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  // Editor choice modal state
  const [editorTarget, setEditorTarget] = useState(null); // { id, name, filename }

  // Collaborators panel state
  const [collabTarget, setCollabTarget] = useState(null);

  // Snapshot status per file
  const [snapStatus, setSnapStatus] = useState({});

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // ── Load files ─────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    if (!token) { navigate("/login"); return; }

    try {
      const res = await axios.get(
        `http://localhost:5001/api/manuscripts/${id}`,
        { headers }
      );
      setFiles(res.data);
    } catch (err) {
      console.error("Load files error:", err);
    }
  }, [id]); // eslint-disable-line

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const uploadFile = async () => {
    if (!file || file.length === 0) {
      setUploadStatus({ type: "error", msg: "Please select files first." });
      return;
    }

    setUploading(true);
    setUploadStatus(null);

    try {
      for (let i = 0; i < file.length; i++) {
        const formData = new FormData();
        formData.append("file", file[i]);
        formData.append("project_id", id);

        await axios.post(
          "http://localhost:5001/api/manuscripts/upload",
          formData,
          { headers: { ...headers, "Content-Type": "multipart/form-data" } }
        );
      }
      setUploadStatus({ type: "success", msg: `${file.length} file(s) uploaded successfully.` });
      setFile([]);
      loadFiles();
    } catch (err) {
      setUploadStatus({ type: "error", msg: "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const downloadFile = async (fileId, filename) => {
    try {
      const res = await axios.get(
        `http://localhost:5001/api/manuscripts/download/${fileId}`,
        { headers, responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename || "file");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Download failed");
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteFile = async (fileId) => {
    if (!window.confirm("Delete this version?")) return;
    try {
      await axios.delete(
        `http://localhost:5001/api/manuscripts/${fileId}`,
        { headers }
      );
      loadFiles();
    } catch (err) {
      alert("Delete failed");
    }
  };

  // ── Restore ────────────────────────────────────────────────────────────────
  const restoreFile = async (fileId) => {
    if (!window.confirm("Restore this version as the latest?")) return;
    try {
      await axios.post(
        `http://localhost:5001/api/manuscripts/restore/${fileId}`,
        {},
        { headers }
      );
      loadFiles();
    } catch (err) {
      alert("Restore failed");
    }
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
        `http://localhost:5001/api/manuscripts/snapshot/${fileId}`,
        { label },
        { headers }
      );
      setSnapStatus((p) => ({ ...p, [name]: `✅ "${label}" saved` }));
      setTimeout(() => setSnapStatus((p) => ({ ...p, [name]: null })), 4000);
      loadFiles();
    } catch (err) {
      alert("Snapshot failed");
    }
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) setFile(e.dataTransfer.files);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="content">

      {/* ── Upload Card ── */}
      <div className="card">
        <h2>Project {id} — Files</h2>

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
          <label htmlFor="fileUpload">
            <p className="drop-title">Drag & Drop files here</p>
            <p className="drop-sub">or click to browse</p>
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
        >
          {uploading ? "Uploading…" : "Upload Files"}
        </button>

        {uploadStatus && (
          <p style={{
            marginTop: "10px",
            color: uploadStatus.type === "success" ? "#2d7a4f" : "#c0392b",
            fontSize: "14px",
          }}>
            {uploadStatus.msg}
          </p>
        )}
      </div>

      {/* ── Files Card ── */}
      <div className="card">
        <h3>Files</h3>

        {Object.keys(files).length === 0 ? (
          <p style={{ color: "#aaa", fontStyle: "italic" }}>No files uploaded yet.</p>
        ) : (
          Object.keys(files).map((name) => {
            const versions = files[name];
            const latestNonSnapshot = versions.find((f) => !f.is_snapshot);
            const editable = versions[0]?.editable;

            return (
              <div key={name} className="file-group">

                {/* File header */}
                <div style={s.fileHeader}>
                  <span style={s.fileName}>
                    {fileIcon(name)} {name}
                  </span>

                  <div style={s.fileHeaderActions}>
                    {snapStatus[name] && (
                      <span style={s.snapStatus}>{snapStatus[name]}</span>
                    )}

                    {/* Open In... button — only for editable formats */}
                    {editable && latestNonSnapshot && (
                      <button
                        style={s.openInBtn}
                        onClick={() => setEditorTarget({
                          id: latestNonSnapshot.id,
                          name,
                          filename: latestNonSnapshot.filename
                        })}
                      >
                        ✏️ Open In…
                      </button>
                    )}

                    {/* Collaborators */}
                    <button
                      style={s.collabBtn}
                      onClick={() => setCollabTarget({ name })}
                    >
                      👥 Collaborators
                    </button>
                  </div>
                </div>

                {/* Version rows */}
                {versions.map((f) => (
                  <div
                    key={f.id}
                    className="file-row"
                    style={f.is_snapshot ? s.snapshotRow : undefined}
                  >
                    <div className="file-info">
                      {f.is_snapshot ? (
                        <span style={s.snapshotBadge}>
                          📌 {f.snapshot_label || "Snapshot"}
                        </span>
                      ) : (
                        <span>Version {f.version}</span>
                      )}
                      <span className="file-date">
                        {new Date(f.last_modified || f.uploaded_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="file-actions">
                      <button onClick={() => downloadFile(f.id, name)}>
                        ⬇ Download
                      </button>

                      {!f.is_snapshot && (
                        <>
                          <button onClick={() => restoreFile(f.id)}>
                            🔄 Restore
                          </button>
                          <button onClick={() => takeSnapshot(f.id, name)}>
                            📌 Snapshot
                          </button>
                        </>
                      )}

                      <button onClick={() => deleteFile(f.id)}>
                        🗑 Delete
                      </button>

                      <button
                        onClick={() =>
                          window.open(
                            `http://localhost:5001/uploads/${f.filename}`,
                            "_blank"
                          )
                        }
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

      {/* ── Editor Choice Modal ── */}
      {editorTarget && (
        <EditorChoiceModal
          manuscriptId={editorTarget.id}
          manuscriptName={editorTarget.name}
          fileUrl={`http://localhost:5001/uploads/${editorTarget.filename}`}
          onClose={() => setEditorTarget(null)}
          onOpenCollabora={() => navigate(`/editor/${editorTarget.id}`)}
        />
      )}

      {/* ── Collaborators Panel ── */}
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

// ── Styles ───────────────────────────────────────────────────────────────────

const s = {
  fileHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "8px",
  },
  fileName: {
    fontWeight: 700,
    fontSize: "15px",
    color: "#1a1a2e",
  },
  fileHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  openInBtn: {
    background: "linear-gradient(135deg, #6c63ff, #9b59b6)",
    color: "#fff",
    border: "none",
    padding: "6px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  collabBtn: {
    background: "#f0f0f8",
    color: "#6c63ff",
    border: "1px solid #d0c8ff",
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  snapshotRow: {
    background: "#fffdf0",
    borderLeft: "3px solid #f0c040",
  },
  snapshotBadge: {
    background: "#fff8dc",
    color: "#9a6d00",
    padding: "2px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 600,
    border: "1px solid #f0c040",
  },
  snapStatus: {
    fontSize: "12px",
    color: "#2d7a4f",
    fontWeight: 500,
  },
};

export default ProjectDetail;
