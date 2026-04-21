# OneStop Publishing — Collabora Integration Guide

## What Was Added

### Backend (`app.py`)
| Feature | Endpoint |
|---|---|
| WOPI CheckFileInfo | `GET /wopi/files/<id>` |
| WOPI GetFile | `GET /wopi/files/<id>/contents` |
| WOPI PutFile (auto-save) | `POST /wopi/files/<id>/contents` |
| WOPI Lock/Unlock | `POST /wopi/files/<id>` |
| Generate editor token | `POST /api/wopi/token/<manuscript_id>` |
| Add collaborator | `POST /api/collaborators/<project_id>/<filename>` |
| List collaborators | `GET /api/collaborators/<project_id>/<filename>` |
| Remove collaborator | `DELETE /api/collaborators/<collab_id>` |
| Create named snapshot | `POST /api/manuscripts/snapshot/<id>` |

### New DB Models
- `WopiToken` — short-lived access tokens (8hr TTL) per user per file
- `WopiLock` — tracks document lock state for concurrent editing
- `DocumentCollaborator` — per-document access control (editor | reviewer)
- `Manuscript` — added `is_snapshot`, `snapshot_label`, `last_modified`

### Frontend
| File | Change |
|---|---|
| `src/pages/Editor.js` | **New** — full-screen Collabora iframe + snapshot modal |
| `src/pages/ProjectDetail.js` | **Updated** — "Open Editor" + "Collaborators" + Snapshot buttons |
| `src/components/CollaboratorsPanel.js` | **New** — slide-in panel to invite/remove collaborators |
| `src/App.js` | **Updated** — added `/editor/:id` route, hides navbar in editor |

---

## Setup Steps

### 1. Run the Database Migration

```bash
cd backend
flask db migrate -m "add wopi collaborators snapshots"
flask db upgrade
```

Or if starting fresh:
```bash
flask db upgrade
```

### 2. Start Collabora Online (Docker required)

```bash
# From the project root
docker-compose up -d collabora

# Verify it's running
curl http://localhost:9980/hosting/discovery
```

You should see XML output listing supported MIME types.

### 3. Start the Flask Backend

```bash
cd backend
pip install -r requirements.txt   # if you add new deps
python app.py
```

### 4. Start the React Frontend

```bash
cd frontend
npm start
```

---

## How the Editor Works

```
User clicks "Open Editor" in ProjectDetail
    ↓
React calls POST /api/wopi/token/<manuscript_id>  (JWT auth)
    ↓
Flask creates a WopiToken (64-char random, 8hr TTL)
Flask builds: collabora_url + ?WOPISrc=<your_backend>/wopi/files/<id>&access_token=<token>
    ↓
Editor.js renders <iframe src={editor_url} />
    ↓
Collabora calls GET /wopi/files/<id>?access_token=...  → CheckFileInfo
Collabora calls GET /wopi/files/<id>/contents?...      → loads document
    ↓
User edits. Collabora auto-saves every ~30s:
    POST /wopi/files/<id>/contents  → Flask overwrites file, updates last_modified
    ↓
User clicks "Save Snapshot" → POST /api/manuscripts/snapshot/<id>
    → creates a permanent named copy in the DB
```

---

## Collaborator Roles

| Role | Can View | Can Edit | Track Changes |
|---|---|---|---|
| **Owner** (project creator) | ✅ | ✅ | Accept / Reject |
| **Editor** | ✅ | ✅ | Accept / Reject |
| **Reviewer** | ✅ | ❌ (read-only) | Add comments only |

### How to invite a collaborator:
1. Go to a project → click **👥 Collaborators** next to a file
2. Enter their email (they must have an account)
3. Choose **Editor** or **Reviewer**
4. They can then open the file in the editor from their dashboard

---

## Track Changes / Accept & Reject

Track changes is a **native LibreOffice feature** exposed through Collabora.

Inside the editor (once open):
- **Enable Track Changes**: Edit → Track Changes → Record Changes (or `Ctrl+Shift+C`)
- **Show Changes**: Edit → Track Changes → Show Changes
- **Accept/Reject**: Edit → Track Changes → Manage Track Changes

Reviewers' edits appear highlighted. Authors (editors/owners) can accept or reject each change from within the Collabora UI — exactly like MS Word.

---

## Production Checklist

- [ ] Replace `sqlite:///database.db` with PostgreSQL URI
- [ ] Set strong `FLASK_SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] Set `BACKEND_URL` to your real domain (Collabora must reach it)
- [ ] Set `COLLABORA_URL` to your real domain
- [ ] Put Collabora behind nginx with SSL (`ssl.enable=true`)
- [ ] Use S3/MinIO for file storage instead of local `uploads/` folder
- [ ] Add email sending (SendGrid/SES) for verification & invites
- [ ] Set Collabora `aliasgroup1` to your production backend domain
- [ ] Cloudflare R2: set `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (optional `R2_ENABLED=true`)
- [ ] Railway deploy: use the repo `Procfile` (entrypoint runs `flask db upgrade` then Gunicorn)
