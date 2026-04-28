from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
from flask import Flask, redirect, url_for, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv, dotenv_values
from passlib.hash import bcrypt
from flask import send_file
from flask import send_from_directory
import boto3
from collections import defaultdict
from itsdangerous import URLSafeTimedSerializer
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
import os
import re
import uuid
import shutil
import hashlib
import base64

# ==========================
# LOAD ENV  (override=True forces re-read every restart)
# ==========================

load_dotenv(override=False)

# ==========================
# EMAIL (Resend)
# ==========================

import resend
resend.api_key = os.getenv("RESEND_API_KEY")

def send_email(to_email, subject, html_body):
    # Use onboarding@resend.dev until your domain is verified on Resend
    # Once verified, change to: noreply@yourdomain.com
    sender = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
    resend.Emails.send({
        "from": sender,
        "to": to_email,
        "subject": subject,
        "html": html_body
    })

# ==========================
# CREATE APP
# ==========================

app = Flask(__name__)

# ProxyFix: Railway runs behind a reverse proxy.
# Without this, url_for(_external=True) generates http:// instead of https://
# which breaks Google OAuth (Error 400: redirect_uri_mismatch).
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1, x_for=1)

# Absolute paths so CWD differences (local vs Railway) don't break storage.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


@app.route("/health")
def health():
    """Railway uses this endpoint to verify the backend is alive."""
    return jsonify({"status": "ok"}), 200


os.makedirs(app.instance_path, exist_ok=True)
DB_PATH = os.path.join(app.instance_path, "database.db")


@app.after_request
def add_headers(response):
    """
    Three things every response needs for Word Online to work:

    1. ngrok-skip-browser-warning
       Stops ngrok injecting its interstitial HTML page when
       Microsoft's servers call the WOPI endpoints.

    2. X-Frame-Options / Content-Security-Policy
       Word Online runs inside an <iframe>.  Without these the
       browser blocks it.  ALLOWALL is intentional for development;
       tighten to specific origins in production.

    3. Access-Control-Allow-Origin for Word Online domains
       flask-cors handles localhost; we add the MS domains here so
       Word Online can read response headers from JS inside the iframe.
    """
    _fe = os.getenv("FRONTEND_URL", "http://localhost:3000")
    response.headers["ngrok-skip-browser-warning"] = "69420"
    response.headers["X-Frame-Options"]             = "ALLOWALL"
    response.headers["Content-Security-Policy"] = (
        f"frame-ancestors 'self' "
        f"https://*.officeapps.live.com "
        f"https://*.microsoft.com "
        f"http://localhost:3000 "
        f"{_fe} "
        f"https://*.ngrok-free.app"
    )
    return response


_FE_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
_ORIGINS = list({
    "http://localhost:3000",
    "https://*.officeapps.live.com",
    "https://*.microsoft.com",
    "https://*.ngrok-free.app",
    _FE_URL,
})
CORS(
    app,
    origins=_ORIGINS,
    supports_credentials=True,
    allow_headers=[
        "Content-Type", "Authorization",
        "X-WOPI-Override", "X-WOPI-Lock", "X-WOPI-OldLock",
        "X-WOPI-ItemVersion", "X-WOPI-SuggestedTarget",
    ],
    expose_headers=[
        "X-WOPI-Lock", "X-WOPI-LockFailureReason",
        "X-WOPI-ItemVersion", "X-WOPI-ValidRelativeTarget",
    ],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
)

app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
app.config["JWT_TOKEN_LOCATION"]       = ["headers", "query_string"]
app.config["JWT_QUERY_STRING_NAME"]    = "jwt_token"
app.secret_key                         = os.getenv("FLASK_SECRET_KEY") or os.urandom(24).hex()
app.config["JWT_SECRET_KEY"]           = os.getenv("JWT_SECRET_KEY") or app.secret_key
app.config["SQLALCHEMY_DATABASE_URI"]  = os.getenv("DATABASE_URL") or f"sqlite:///{DB_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db       = SQLAlchemy(app)
migrate  = Migrate(app, db)
jwt      = JWTManager(app)
oauth    = OAuth(app)

serializer = URLSafeTimedSerializer(os.getenv("JWT_SECRET_KEY"))


# ==========================
# MODELS
# ==========================

# ── Publishing Role Hierarchy ─────────────────────────────────────────────────
# publisher_admin  → Platform owner. Full access to all projects and users.
# editor_in_chief  → Oversees all editorial decisions and workflow.
# managing_editor  → Assigns manuscripts, tracks submissions and deadlines.
# section_editor   → Handles specific journal sections or book categories.
# copy_editor      → Reviews grammar, style, formatting before publication.
# peer_reviewer    → Provides expert review of submitted manuscripts.
# author           → Submits and manages their own manuscripts. (Default)
# subscriber       → End user — reads and downloads published content.

SYSTEM_ROLES = [
    "publisher_admin",
    "editor_in_chief",
    "managing_editor",
    "section_editor",
    "copy_editor",
    "peer_reviewer",
    "author",
    "subscriber",
]

ROLE_LABELS = {
    "publisher_admin": "Publisher Admin",
    "editor_in_chief": "Editor-in-Chief",
    "managing_editor": "Managing Editor",
    "section_editor":  "Section Editor",
    "copy_editor":     "Copy Editor",
    "peer_reviewer":   "Peer Reviewer",
    "author":          "Author",
    "subscriber":      "Subscriber",
}

# Roles that can create/manage projects
MANAGER_ROLES = {"publisher_admin", "editor_in_chief", "managing_editor"}

# Roles that can upload/edit manuscripts
EDITOR_ROLES  = {"publisher_admin", "editor_in_chief", "managing_editor",
                 "section_editor", "copy_editor", "author"}


class User(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    email       = db.Column(db.String(255), unique=True, nullable=False)
    password    = db.Column(db.String(255))
    name        = db.Column(db.String(255))
    is_verified = db.Column(db.Boolean, default=False)
    system_role = db.Column(db.String(50), default="author")   # publishing hierarchy role
    projects    = db.relationship("Project", backref="owner", lazy=True)


class Project(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    title       = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    created_at  = db.Column(db.DateTime, server_default=db.func.now())
    user_id     = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)


class Manuscript(db.Model):
    id             = db.Column(db.Integer, primary_key=True)
    name           = db.Column(db.String(255), nullable=False)
    filename       = db.Column(db.String(255))
    filepath       = db.Column(db.String(500))
    version        = db.Column(db.Integer, default=1)
    is_snapshot    = db.Column(db.Boolean, default=False)
    snapshot_label = db.Column(db.String(255))
    uploaded_at    = db.Column(db.DateTime, server_default=db.func.now())
    last_modified  = db.Column(db.DateTime, server_default=db.func.now())
    project_id     = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)


class DocumentCollaborator(db.Model):
    id              = db.Column(db.Integer, primary_key=True)
    manuscript_name = db.Column(db.String(255), nullable=False)
    project_id      = db.Column(db.Integer, db.ForeignKey("project.id"), nullable=False)
    user_id         = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    role            = db.Column(db.String(50), default="reviewer")
    added_at        = db.Column(db.DateTime, server_default=db.func.now())


class WopiToken(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    token         = db.Column(db.String(64), unique=True, nullable=False)
    manuscript_id = db.Column(db.Integer, db.ForeignKey("manuscript.id"), nullable=False)
    user_id       = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    can_write     = db.Column(db.Boolean, default=True)
    expires_at    = db.Column(db.DateTime, nullable=False)
    created_at    = db.Column(db.DateTime, server_default=db.func.now())


class WopiLock(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    manuscript_id = db.Column(db.Integer, db.ForeignKey("manuscript.id"), unique=True)
    lock_string   = db.Column(db.String(1024))
    locked_at     = db.Column(db.DateTime, server_default=db.func.now())


class TempDownloadToken(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    token         = db.Column(db.String(64), unique=True, nullable=False)
    manuscript_id = db.Column(db.Integer, db.ForeignKey("manuscript.id"), nullable=False)
    expires_at    = db.Column(db.DateTime, nullable=False)
    created_at    = db.Column(db.DateTime, server_default=db.func.now())


# ==========================
# HELPERS
# ==========================

MIME_MAP = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc":  "application/msword",
    "odt":  "application/vnd.oasis.opendocument.text",
}

# ==========================
# Storage helpers (Local or R2)
# ==========================

R2_ENDPOINT = os.getenv("R2_ENDPOINT", "").strip()
R2_BUCKET = os.getenv("R2_BUCKET", "").strip()
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "").strip()
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
R2_REGION = os.getenv("R2_REGION", "auto").strip()

_R2_CLIENT = None


def _storage_is_r2_enabled():
    # Explicit control beats inference.
    r2_enabled_raw = os.getenv("R2_ENABLED", "").strip()
    if r2_enabled_raw:
        return r2_enabled_raw.lower() in ("1", "true", "yes", "y", "on")

    # Otherwise, enable when required R2 config is present.
    return all([R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY])


def _get_r2_client():
    global _R2_CLIENT
    if _R2_CLIENT is not None:
        return _R2_CLIENT

    _R2_CLIENT = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name=R2_REGION or "auto",
    )
    return _R2_CLIENT


def _local_path_for_key(storage_key):
    return os.path.join(UPLOAD_FOLDER, storage_key)


def storage_exists(storage_key):
    if _storage_is_r2_enabled():
        try:
            _get_r2_client().head_object(Bucket=R2_BUCKET, Key=storage_key)
            return True
        except Exception:
            return False

    return bool(storage_key) and os.path.exists(_local_path_for_key(storage_key))


def storage_stream_bytes(storage_key, chunk_size=65536):
    """
    Stream file contents from storage, yielding raw bytes chunks.
    """
    if _storage_is_r2_enabled():
        obj = _get_r2_client().get_object(Bucket=R2_BUCKET, Key=storage_key)
        body = obj["Body"]
        try:
            while True:
                chunk = body.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                body.close()
            except Exception:
                pass
        return

    local_path = _local_path_for_key(storage_key)
    with open(local_path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            yield chunk


def storage_upload_bytes(storage_key, data, content_type="application/octet-stream"):
    if _storage_is_r2_enabled():
        _get_r2_client().put_object(
            Bucket=R2_BUCKET,
            Key=storage_key,
            Body=data,
            ContentType=content_type or "application/octet-stream",
        )
        return

    local_path = _local_path_for_key(storage_key)
    # UPLOAD_FOLDER is already created at startup; keep this defensive.
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    tmp_path = local_path + ".tmp"
    try:
        with open(tmp_path, "wb") as f:
            f.write(data)
        os.replace(tmp_path, local_path)
    except Exception:
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception:
            pass
        raise


def storage_delete(storage_key):
    if _storage_is_r2_enabled():
        _get_r2_client().delete_object(Bucket=R2_BUCKET, Key=storage_key)
        return

    local_path = _local_path_for_key(storage_key)
    if os.path.exists(local_path):
        os.remove(local_path)


def storage_copy(source_key, dest_key):
    if _storage_is_r2_enabled():
        _get_r2_client().copy_object(
            Bucket=R2_BUCKET,
            CopySource={"Bucket": R2_BUCKET, "Key": source_key},
            Key=dest_key,
        )
        return

    src = _local_path_for_key(source_key)
    dst = _local_path_for_key(dest_key)
    shutil.copy(src, dst)


def _file_sha256_and_size(storage_key):
    """Return (sha256_b64, size_bytes) for a storage key."""
    if not storage_key:
        return "", 0

    h = hashlib.sha256()
    size = 0

    if _storage_is_r2_enabled():
        try:
            obj = _get_r2_client().get_object(Bucket=R2_BUCKET, Key=storage_key)
            body = obj["Body"]
            try:
                while True:
                    chunk = body.read(65536)
                    if not chunk:
                        break
                    h.update(chunk)
                    size += len(chunk)
            finally:
                try:
                    body.close()
                except Exception:
                    pass
            return base64.b64encode(h.digest()).decode(), size
        except Exception:
            return "", 0

    local_path = _local_path_for_key(storage_key)
    if not os.path.exists(local_path):
        return "", 0

    with open(local_path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
            size += len(chunk)
    return base64.b64encode(h.digest()).decode(), size


def _version_str(manuscript):
    """
    Stable, monotonically-increasing version string.
    Uses ms-epoch timestamp so it changes on every save.
    """
    ts = manuscript.last_modified or manuscript.uploaded_at
    if ts:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return str(int(ts.timestamp() * 1000))
    return "1"


def _get_urls():
    """Return (backend_url, frontend_url) from env, printing for debug."""
    backend_url  = os.getenv("BACKEND_URL",  "http://localhost:5001")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    print(f"[WOPI] BACKEND_URL={backend_url}  FRONTEND_URL={frontend_url}")
    return backend_url, frontend_url


# ==========================
# GOOGLE OAUTH
# ==========================

oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


@app.route("/auth/google")
def google_login():
    # Use BACKEND_URL directly to guarantee https:// in production.
    # url_for(_external=True) was generating http:// on Railway (Error 400).
    backend_url  = os.getenv("BACKEND_URL", "http://localhost:5001").rstrip("/")
    redirect_uri = f"{backend_url}/auth/google/callback"
    return oauth.google.authorize_redirect(redirect_uri)


@app.route("/auth/google/callback")
def google_callback():
    # Authlib already stores redirect_uri in the session from authorize_redirect().
    # Do NOT pass it again here — causes "multiple values for keyword argument" error.
    token     = oauth.google.authorize_access_token()
    user_info = oauth.google.get("https://openidconnect.googleapis.com/v1/userinfo").json()
    email     = user_info["email"]
    name      = user_info.get("name")

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email, name=name, is_verified=True)
        db.session.add(user)
        db.session.commit()

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "name":  user.name  or "",
            "email": user.email or "",
            "role":  user.system_role or "author",
        },
        expires_delta=timedelta(hours=24)
    )
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return redirect(f"{frontend_url}/dashboard?token={access_token}")


# ==========================
# AUTH APIs
# ==========================

@app.route("/api/signup", methods=["POST"])
def signup():
    data             = request.json
    name             = data.get("name", "").strip()
    email            = data.get("email", "").strip().lower()
    password         = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    # ── Validation ────────────────────────────────────────────────────────────
    if len(name) < 3:
        return jsonify({"error": "Name must be at least 3 characters"}), 400
    if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
        return jsonify({"error": "Invalid email format"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if not re.match(r"^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$", password):
        return jsonify({"error": "Password must include uppercase, lowercase, number and special character (@$!%*?&)"}), 400
    if password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "This email is already registered"}), 400

    # ── Create user — verified by default (email verification disabled for now) ─
    user = User(
        name        = name,
        email       = email,
        password    = bcrypt.hash(password[:72]),
        is_verified = True,    # Set True — email verification bypassed via Resend
        system_role = "author" # Default role for new signups
    )
    db.session.add(user)
    db.session.commit()

    # ── Send welcome email via Resend (non-blocking) ──────────────────────────
    try:
        send_email(
            email,
            "Welcome to OneStop Publishing!",
            f"""
            <div style="font-family: sans-serif; max-width: 560px; margin: auto; padding: 32px;">
                <h2 style="color: #0F2344;">Welcome, {name}! 👋</h2>
                <p style="color: #5C6B8A; line-height: 1.7;">
                    Your OneStop Publishing account has been created successfully.
                    You can now sign in and start managing your manuscripts.
                </p>
                <a href="{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/login"
                   style="display:inline-block; margin-top:20px; padding:12px 28px;
                          background:#0F2344; color:white; border-radius:8px;
                          text-decoration:none; font-weight:600;">
                    Sign In →
                </a>
                <p style="margin-top:32px; font-size:12px; color:#8F9EBA;">
                    If you did not create this account, please ignore this email.
                </p>
            </div>
            """
        )
    except Exception as e:
        # Email failure should NOT block account creation
        app.logger.warning(f"Welcome email failed for {email}: {e}")

    # Generate JWT so frontend can optionally auto-login after signup
    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "name":  user.name  or "",
            "email": user.email or "",
            "role":  user.system_role or "author",
        },
        expires_delta=timedelta(hours=24)
    )
    return jsonify({
        "message": "Account created successfully! You can now sign in.",
        "token": access_token,
    })


@app.route("/api/verify/<token>")
def verify_email(token):
    # Email verification is currently disabled — users are auto-verified on signup.
    # This route is kept for backward compatibility with any existing verify links.
    try:
        email = serializer.loads(token, salt="email-verify", max_age=86400)
    except Exception:
        return jsonify({"message": "Invalid or expired verification link"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "User not found"}), 404

    if user.is_verified:
        return jsonify({"message": "Email already verified. You can sign in."})

    user.is_verified = True
    db.session.commit()
    return jsonify({"message": "Email verified successfully! You can now sign in."})


@app.route("/api/login", methods=["POST"])
def login():
    data     = request.json
    email    = data.get("email")
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.verify(password[:72], user.password):
        return jsonify({"error": "Invalid credentials"}), 401
    if not user.is_verified:
        return jsonify({"message": "Please verify your email first"}), 403

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "name":  user.name  or "",
            "email": user.email or "",
            "role":  user.system_role or "author",
        },
        expires_delta=timedelta(hours=24)
    )
    return jsonify({
        "token": access_token,
        "user": {
            "id":    user.id,
            "name":  user.name,
            "email": user.email,
            "role":  user.system_role or "author",
        }
    })


@app.route("/api/resend-verification", methods=["POST"])
def resend_verification():
    # Email verification is disabled — users are auto-verified on signup.
    # If user is not verified (legacy accounts), mark them as verified directly.
    email = request.json.get("email", "").strip().lower()
    user  = User.query.filter_by(email=email).first()
    if not user:
        # Return generic message to prevent email enumeration
        return jsonify({"message": "If this email exists, it has been verified."})
    if not user.is_verified:
        user.is_verified = True
        db.session.commit()
    return jsonify({"message": "Your account is verified. You can now sign in."})


@app.route("/api/me", methods=["GET"])
@jwt_required()
def get_me():
    """Returns current user profile including role."""
    user_id = get_jwt_identity()
    user    = User.query.get(int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({
        "id":    user.id,
        "name":  user.name,
        "email": user.email,
        "role":  user.system_role or "author",
        "role_label": ROLE_LABELS.get(user.system_role, "Author"),
    })


@app.route("/api/me/role", methods=["PUT"])
@jwt_required()
def update_role():
    """Publisher admin can update any user role. Others cannot."""
    current_user_id = get_jwt_identity()
    current_user    = User.query.get(int(current_user_id))

    if current_user.system_role != "publisher_admin":
        return jsonify({"error": "Only Publisher Admins can change roles"}), 403

    data        = request.json
    target_email = data.get("email", "").strip().lower()
    new_role    = data.get("role", "")

    if new_role not in SYSTEM_ROLES:
        return jsonify({"error": f"Invalid role. Must be one of: {', '.join(SYSTEM_ROLES)}"}), 400

    target_user = User.query.filter_by(email=target_email).first()
    if not target_user:
        return jsonify({"error": "User not found"}), 404

    target_user.system_role = new_role
    db.session.commit()
    return jsonify({
        "message": f"{target_user.name}'s role updated to {ROLE_LABELS[new_role]}"
    })


@app.route("/api/users", methods=["GET"])
@jwt_required()
def list_users():
    """Publisher admin and editors can list users."""
    current_user_id = get_jwt_identity()
    current_user    = User.query.get(int(current_user_id))

    if current_user.system_role not in MANAGER_ROLES:
        return jsonify({"error": "Access denied"}), 403

    users = User.query.all()
    return jsonify([{
        "id":         u.id,
        "name":       u.name,
        "email":      u.email,
        "role":       u.system_role or "author",
        "role_label": ROLE_LABELS.get(u.system_role, "Author"),
    } for u in users])


@app.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    email = request.json.get("email", "").strip().lower()
    user  = User.query.filter_by(email=email).first()
    # Always return same message to prevent email enumeration
    if not user:
        return jsonify({"message": "If this email is registered, a reset link has been sent."})

    token        = serializer.dumps(email, salt="reset-password")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    reset_url    = f"{frontend_url}/reset/{token}"

    try:
        send_email(
            email,
            "Reset your OneStop Publishing password",
            f"""
            <div style="font-family: sans-serif; max-width: 560px; margin: auto; padding: 32px;">
                <h2 style="color: #0F2344;">Password Reset Request</h2>
                <p style="color: #5C6B8A; line-height: 1.7;">
                    Hi {user.name or "there"},<br><br>
                    We received a request to reset your password.
                    Click the button below to choose a new password.
                    This link expires in <strong>1 hour</strong>.
                </p>
                <a href="{reset_url}"
                   style="display:inline-block; margin-top:20px; padding:12px 28px;
                          background:#0F2344; color:white; border-radius:8px;
                          text-decoration:none; font-weight:600;">
                    Reset Password →
                </a>
                <p style="margin-top:24px; font-size:12px; color:#8F9EBA;">
                    If you didn't request this, you can safely ignore this email.
                    Your password will not be changed.
                </p>
            </div>
            """
        )
    except Exception as e:
        app.logger.warning(f"Password reset email failed for {email}: {e}")

    return jsonify({"message": "If this email is registered, a reset link has been sent."})


@app.route("/api/reset-password", methods=["POST"])
def reset_password():
    data     = request.json
    token    = data.get("token")
    password = data.get("password")
    try:
        email = serializer.loads(token, salt="reset-password", max_age=3600)
    except Exception:
        return jsonify({"message": "Invalid or expired token"}), 400

    user = User.query.filter_by(email=email).first()
    user.password = bcrypt.hash(password[:72])
    db.session.commit()
    return jsonify({"message": "Password updated successfully"})


# ==========================
# PROJECT APIs
# ==========================

@app.route("/api/projects", methods=["POST"])
@jwt_required()
def create_project():
    current_user_id = int(get_jwt_identity())
    data = request.json
    db.session.add(Project(
        title=data["title"],
        description=data.get("description", ""),
        user_id=current_user_id
    ))
    db.session.commit()
    return jsonify({"message": "Project created successfully"})


@app.route("/api/projects", methods=["GET"])
@jwt_required()
def get_projects():
    current_user_id = int(get_jwt_identity())
    projects = Project.query.filter_by(user_id=current_user_id).all()
    return jsonify([
        {"id": p.id, "title": p.title, "description": p.description, "created_at": p.created_at}
        for p in projects
    ])


# ==========================
# FILE UPLOAD / STORAGE
# ==========================

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS  = {"pdf","png","jpg","jpeg","eps","xml","xls","xlsx","csv","ppt","pptx","tex","zip","doc","docx","odt"}
EDITABLE_EXTENSIONS = {"docx", "odt", "doc"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def is_editable(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in EDITABLE_EXTENSIONS


@app.route("/api/manuscripts/upload", methods=["POST"])
@jwt_required()
def upload_manuscript():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400

    file       = request.files["file"]
    project_id = request.form["project_id"]

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Unsupported file format"}), 400

    original_name = secure_filename(file.filename)
    existing = Manuscript.query.filter_by(
        project_id=project_id, name=original_name, is_snapshot=False
    ).order_by(Manuscript.version.desc()).first()

    version         = existing.version + 1 if existing else 1
    stored_filename = f"{uuid.uuid4()}_{original_name}"
    ext             = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    content_type   = MIME_MAP.get(ext, "application/octet-stream")

    if _storage_is_r2_enabled():
        # For R2 we store by key (= filename). `filepath` is not used for storage.
        filepath = stored_filename
        storage_upload_bytes(stored_filename, file.read(), content_type=content_type)
    else:
        filepath = os.path.join(UPLOAD_FOLDER, stored_filename)
        file.save(filepath)

    manuscript = Manuscript(
        name=original_name, filename=stored_filename,
        filepath=filepath, version=version, project_id=project_id
    )
    db.session.add(manuscript)
    db.session.commit()

    return jsonify({
        "message": "Uploaded", "version": version,
        "id": manuscript.id, "editable": is_editable(original_name)
    })


@app.route("/api/manuscripts/<int:project_id>", methods=["GET"])
@jwt_required()
def get_manuscripts(project_id):
    manuscripts = Manuscript.query.filter_by(
        project_id=project_id
    ).order_by(Manuscript.name, Manuscript.version.desc()).all()

    grouped = defaultdict(list)
    for m in manuscripts:
        grouped[m.name].append({
            "id": m.id, "filename": m.filename, "version": m.version,
            "is_snapshot": m.is_snapshot, "snapshot_label": m.snapshot_label,
            "uploaded_at": m.uploaded_at, "last_modified": m.last_modified,
            "editable": is_editable(m.name)
        })
    return jsonify(grouped)


@app.route("/api/manuscripts/download/<int:file_id>", methods=["GET"])
@jwt_required()
def download_file(file_id):
    file = db.session.get(Manuscript, file_id)
    if not file:
        return jsonify({"error": "Not found"}), 404
    ext = file.name.rsplit(".", 1)[-1].lower() if "." in file.name else ""
    mime = MIME_MAP.get(ext, "application/octet-stream")
    if not storage_exists(file.filename):
        return jsonify({"error": "File not found"}), 404

    resp = Response(
        stream_with_context(storage_stream_bytes(file.filename)),
        mimetype=mime,
    )
    resp.headers["Content-Disposition"] = f'attachment; filename="{file.name}"'
    return resp


@app.route("/api/manuscripts/<int:file_id>", methods=["DELETE"])
@jwt_required()
def delete_file(file_id):
    file = db.session.get(Manuscript, file_id)
    if not file:
        return jsonify({"error": "Not found"}), 404
    storage_delete(file.filename)
    db.session.delete(file)
    db.session.commit()
    return jsonify({"message": "File deleted"})


@app.route("/api/manuscripts/restore/<int:file_id>", methods=["POST"])
@jwt_required()
def restore_version(file_id):
    old    = db.session.get(Manuscript, file_id)
    latest = Manuscript.query.filter_by(
        project_id=old.project_id, name=old.name, is_snapshot=False
    ).order_by(Manuscript.version.desc()).first()

    new_version  = latest.version + 1
    new_filename = f"{uuid.uuid4()}_{old.name}"
    storage_copy(old.filename, new_filename)

    filepath = new_filename if _storage_is_r2_enabled() else os.path.join(UPLOAD_FOLDER, new_filename)

    db.session.add(Manuscript(
        name=old.name, filename=new_filename, filepath=filepath,
        version=new_version, project_id=old.project_id
    ))
    db.session.commit()
    return jsonify({"message": "Version restored", "version": new_version})


@app.route("/api/manuscripts/snapshot/<int:file_id>", methods=["POST"])
@jwt_required()
def create_snapshot(file_id):
    data   = request.json or {}
    label  = data.get("label", f"Snapshot {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}")
    source = db.session.get(Manuscript, file_id)

    snap_filename = f"{uuid.uuid4()}_{source.name}"
    storage_copy(source.filename, snap_filename)

    snap_path = snap_filename if _storage_is_r2_enabled() else os.path.join(UPLOAD_FOLDER, snap_filename)

    db.session.add(Manuscript(
        name=source.name, filename=snap_filename, filepath=snap_path,
        version=source.version, is_snapshot=True, snapshot_label=label,
        project_id=source.project_id
    ))
    db.session.commit()
    return jsonify({"message": "Snapshot created", "label": label})


@app.route("/uploads/<filename>")
def serve_file(filename):
    manuscript = Manuscript.query.filter_by(filename=filename).first()
    if not manuscript or not storage_exists(filename):
        return jsonify({"error": "File not found"}), 404

    ext = manuscript.name.rsplit(".", 1)[-1].lower() if "." in manuscript.name else ""
    mime = MIME_MAP.get(ext, "application/octet-stream")

    resp = Response(
        stream_with_context(storage_stream_bytes(filename)),
        mimetype=mime,
    )
    # Word desktop just needs raw bytes; avoid forcing a specific download filename.
    resp.headers["Content-Disposition"] = f'inline; filename="{manuscript.name}"'
    return resp


# ==========================
# COLLABORATOR APIs
# ==========================

@app.route("/api/collaborators/<int:project_id>/<path:manuscript_name>", methods=["GET"])
@jwt_required()
def get_collaborators(project_id, manuscript_name):
    collaborators = DocumentCollaborator.query.filter_by(
        project_id=project_id, manuscript_name=manuscript_name
    ).all()
    result = []
    for c in collaborators:
        user = db.session.get(User, c.user_id)
        if user:
            result.append({
                "id": c.id, "user_id": c.user_id,
                "name": user.name, "email": user.email,
                "role": c.role, "added_at": c.added_at
            })
    return jsonify(result)


@app.route("/api/collaborators/<int:project_id>/<path:manuscript_name>", methods=["POST"])
@jwt_required()
def add_collaborator(project_id, manuscript_name):
    current_user_id = int(get_jwt_identity())
    data    = request.json
    project = db.session.get(Project, project_id)

    if not project or project.user_id != current_user_id:
        return jsonify({"error": "Only the project owner can add collaborators"}), 403

    email = data.get("email", "").strip().lower()
    role  = data.get("role", "reviewer")

    if role not in ("editor", "reviewer"):
        return jsonify({"error": "Role must be editor or reviewer"}), 400

    invited_user = User.query.filter_by(email=email).first()
    if not invited_user:
        return jsonify({"error": "No user found with that email"}), 404
    if invited_user.id == current_user_id:
        return jsonify({"error": "You are already the owner"}), 400

    existing = DocumentCollaborator.query.filter_by(
        project_id=project_id, manuscript_name=manuscript_name,
        user_id=invited_user.id
    ).first()

    if existing:
        existing.role = role
        db.session.commit()
        return jsonify({"message": "Collaborator role updated"})

    db.session.add(DocumentCollaborator(
        project_id=project_id, manuscript_name=manuscript_name,
        user_id=invited_user.id, role=role
    ))
    db.session.commit()
    return jsonify({"message": f"{invited_user.name} added as {role}"})


@app.route("/api/collaborators/<int:collab_id>", methods=["DELETE"])
@jwt_required()
def remove_collaborator(collab_id):
    current_user_id = int(get_jwt_identity())
    collab  = db.session.get(DocumentCollaborator, collab_id)
    project = db.session.get(Project, collab.project_id)

    if project.user_id != current_user_id:
        return jsonify({"error": "Only the project owner can remove collaborators"}), 403

    db.session.delete(collab)
    db.session.commit()
    return jsonify({"message": "Collaborator removed"})


# ==========================
# WOPI TOKEN GENERATION
# ==========================

@app.route("/api/wopi/token/<int:manuscript_id>", methods=["POST"])
@jwt_required()
def get_wopi_token(manuscript_id):
    current_user_id = int(get_jwt_identity())
    manuscript      = db.session.get(Manuscript, manuscript_id)

    if not manuscript:
        return jsonify({"error": "Not found"}), 404
    if not is_editable(manuscript.name):
        return jsonify({"error": "This file type cannot be edited in the browser"}), 400

    project  = db.session.get(Project, manuscript.project_id)
    is_owner = (project.user_id == current_user_id)

    collaborator = DocumentCollaborator.query.filter_by(
        project_id=manuscript.project_id,
        manuscript_name=manuscript.name,
        user_id=current_user_id
    ).first()

    if not is_owner and not collaborator:
        return jsonify({"error": "Access denied"}), 403

    can_write  = is_owner or (collaborator and collaborator.role == "editor")
    token      = uuid.uuid4().hex + uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)

    db.session.add(WopiToken(
        token=token, manuscript_id=manuscript_id,
        user_id=current_user_id, can_write=can_write,
        expires_at=expires_at
    ))
    db.session.commit()

    backend_url, frontend_url = _get_urls()
    collabora_url = os.getenv("COLLABORA_URL", "http://localhost:9980")

    wopi_src         = f"{backend_url}/wopi/files/{manuscript_id}"
    encoded_wopi_src = quote(wopi_src, safe="")

    # access_token_ttl = Unix epoch in milliseconds
    ttl_ms = int(expires_at.timestamp() * 1000)

    collabora_editor_url = (
        f"{collabora_url}/browser/dist/cool.html"
        f"?WOPISrc={encoded_wopi_src}&access_token={token}"
    )

    word_desktop_url = f"{backend_url}/uploads/{manuscript.filename}"

    # action=edit is required — do NOT add wdOrigin (forces view-only)
    word_online_url = (
        f"https://word-edit.officeapps.live.com/we/wordeditorframe.aspx"
        f"?WOPISrc={encoded_wopi_src}"
        f"&access_token={token}"
        f"&access_token_ttl={ttl_ms}"
        f"&action={'edit' if can_write else 'view'}"
    )

    return jsonify({
        "editor_url":       collabora_editor_url,
        "word_desktop_url": word_desktop_url,
        "word_online_url":  word_online_url,
        "token":            token,
        "can_write":        can_write,
        "manuscript_name":  manuscript.name,
        "version":          manuscript.version
    })


# ==========================
# WOPI HOST ENDPOINTS
# ==========================

def _validate_wopi_token(manuscript_id, token_str):
    """Return (wopi_token, manuscript) or (None, None) if invalid/expired."""
    wt = WopiToken.query.filter_by(
        token=token_str, manuscript_id=manuscript_id
    ).first()

    if not wt:
        return None, None

    expires = wt.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return None, None

    return wt, db.session.get(Manuscript, manuscript_id)


@app.route("/wopi/files/<int:file_id>", methods=["GET"])
def wopi_check_file_info(file_id):
    """
    WOPI CheckFileInfo
    ==================
    The single most critical endpoint. Word Online reads every field
    here before deciding whether to enter edit or view-only mode.

    Key fields for edit mode
    ────────────────────────
    PostMessageOrigin  — MUST be the origin of the PAGE that hosts the
                         Word Online iframe (your React app's origin).
                         Word Online posts messages to window.parent using
                         this origin. If it is wrong or missing, the
                         Host_PostmessageReady handshake cannot complete
                         and Word Online silently falls back to view-only.

    HostEditUrl        — URL Word Online navigates to when the user clicks
                         "Edit Document". Required for the Edit button to
                         appear at all.

    LicenseCheckForEditIsEnabled = False
                       — Skips Microsoft's licence check for self-hosted
                         WOPI hosts. If True the check fails and locks the
                         document in view-only.

    SupportsCoauth = False
                       — Disables co-authoring handshake. If omitted,
                         Word Online attempts its co-authoring protocol
                         which this simple WOPI host does not support,
                         causing a silent downgrade to view-only.

    AllowExternalMarketplace = False
                       — Hides Add-ins store and Developer tab marketplace
                         items. Does not affect the Developer tab itself
                         (that is a client-side Word user setting).
    """
    token_str      = request.args.get("access_token", "")
    wt, manuscript = _validate_wopi_token(file_id, token_str)

    if not wt:
        return jsonify({"error": "Invalid or expired token"}), 401

    user              = db.session.get(User, wt.user_id)
    if not storage_exists(manuscript.filename):
        return jsonify({"error": "File not found in storage"}), 404

    sha256, file_size = _file_sha256_and_size(manuscript.filename)
    version_str       = _version_str(manuscript)
    can_write         = wt.can_write

    ext = ("." + manuscript.name.rsplit(".", 1)[-1].lower()) if "." in manuscript.name else ""

    backend_url, frontend_url = _get_urls()

    wopi_src         = f"{backend_url}/wopi/files/{file_id}"
    encoded_wopi_src = quote(wopi_src, safe="")
    ttl_ms           = int(wt.expires_at.replace(tzinfo=timezone.utc).timestamp() * 1000)

    host_edit_url = (
        f"https://word-edit.officeapps.live.com/we/wordeditorframe.aspx"
        f"?WOPISrc={encoded_wopi_src}"
        f"&access_token={wt.token}"
        f"&access_token_ttl={ttl_ms}"
        f"&action=edit"
    )
    host_view_url = (
        f"https://word-view.officeapps.live.com/wv/wordviewerframe.aspx"
        f"?WOPISrc={encoded_wopi_src}"
        f"&access_token={wt.token}"
        f"&access_token_ttl={ttl_ms}"
        f"&action=view"
    )

    # PostMessageOrigin = origin of the React page hosting the iframe.
    # For local dev this is http://localhost:3000.
    # On production set FRONTEND_URL=https://yourapp.com in .env
    post_message_origin = frontend_url

    return jsonify({
        # ── Core ────────────────────────────────────────────────────────
        "BaseFileName":                 manuscript.name,
        "Size":                         file_size,
        "OwnerId":                      str(wt.user_id),
        "UserId":                       str(wt.user_id),
        "UserFriendlyName":             user.name or user.email,
        "Version":                      version_str,
        "SHA256":                       sha256,
        "FileExtension":                ext,

        # ── Permissions ──────────────────────────────────────────────────
        "UserCanWrite":                 can_write,
        "ReadOnly":                     not can_write,
        "UserCanNotWriteRelative":      True,
        "UserCanRename":                False,
        "UserCanPresent":               False,
        "UserCanAttend":                False,

        # ── Capabilities ─────────────────────────────────────────────────
        "SupportsUpdate":               True,
        "SupportsLocks":                True,
        "SupportsGetLock":              True,
        "SupportsExtendedLockLength":   True,
        "SupportsCoauth":               False,   # prevents co-auth downgrade
        "SupportedShareUrlTypes":       [],

        # ── Edit-mode critical fields ────────────────────────────────────
        "HostEditUrl":                  host_edit_url if can_write else "",
        "HostViewUrl":                  host_view_url,
        "PostMessageOrigin":            post_message_origin,
        "LicenseCheckForEditIsEnabled": False,   # skip MS licence check

        # ── UI controls ──────────────────────────────────────────────────
        "AllowExternalMarketplace":     False,   # hides Add-ins store
        "CloseButtonClosesWindow":      True,
        "DisableTranslation":           False,
        "DisablePrint":                 False,
        "DisableExport":                False,
        "HideSaveOption":               True,    # auto-save handles it
        "HidePrintOption":              False,
        "HideExportOption":             True,
        "HideShareOption":              True,
        "IsAnonymousUser":              False,

        # ── Branding ─────────────────────────────────────────────────────
        "BreadcrumbBrandName":          "OneStop Publishing",
        "BreadcrumbBrandUrl":           frontend_url,
        "BreadcrumbDocName":            manuscript.name,
        "BreadcrumbFolderName":         "My Manuscripts",
        "BreadcrumbFolderUrl":          f"{frontend_url}/dashboard",
    })


@app.route("/wopi/files/<int:file_id>/contents", methods=["GET"])
def wopi_get_file(file_id):
    """WOPI GetFile — streams raw document bytes to the editor."""
    token_str      = request.args.get("access_token", "")
    wt, manuscript = _validate_wopi_token(file_id, token_str)

    if not wt:
        return jsonify({"error": "Invalid or expired token"}), 401
    if not storage_exists(manuscript.filename):
        return jsonify({"error": "File not found"}), 404

    ext  = manuscript.name.rsplit(".", 1)[-1].lower() if "." in manuscript.name else ""
    mime = MIME_MAP.get(ext, "application/octet-stream")
    return Response(
        stream_with_context(storage_stream_bytes(manuscript.filename)),
        mimetype=mime,
    )


@app.route("/wopi/files/<int:file_id>/contents", methods=["POST"])
def wopi_put_file(file_id):
    """WOPI PutFile — editor pushes saved content here. Atomic write."""
    token_str      = request.args.get("access_token", "")
    wt, manuscript = _validate_wopi_token(file_id, token_str)

    if not wt:
        return Response(status=401)
    if not wt.can_write:
        resp = Response(status=409)
        resp.headers["X-WOPI-LockFailureReason"] = "ReadOnly"
        return resp

    ext  = manuscript.name.rsplit(".", 1)[-1].lower() if "." in manuscript.name else ""
    mime = MIME_MAP.get(ext, "application/octet-stream")

    try:
        storage_upload_bytes(manuscript.filename, request.data, content_type=mime)
    except Exception as e:
        print(f"[WOPI] PutFile error: {e}")
        return Response(status=500)

    now = datetime.now(timezone.utc)
    manuscript.last_modified = now
    db.session.commit()

    resp = Response(status=200)
    resp.headers["X-WOPI-ItemVersion"] = str(int(now.timestamp() * 1000))
    return resp


@app.route("/wopi/files/<int:file_id>", methods=["POST"])
def wopi_file_operations(file_id):
    """WOPI Lock / Unlock / RefreshLock / GetLock / UnlockAndRelock."""
    token_str      = request.args.get("access_token", "")
    wt, manuscript = _validate_wopi_token(file_id, token_str)

    if not wt:
        return Response(status=401)

    override       = request.headers.get("X-WOPI-Override", "")
    requested_lock = request.headers.get("X-WOPI-Lock", "")
    old_lock       = request.headers.get("X-WOPI-OldLock", "")
    existing_lock  = WopiLock.query.filter_by(manuscript_id=file_id).first()
    now            = datetime.now(timezone.utc)
    version_str    = _version_str(manuscript)

    print(f"[WOPI] {override} file_id={file_id} lock='{requested_lock[:20] if requested_lock else ''}...'")

    if override == "LOCK":
        if existing_lock and existing_lock.lock_string != requested_lock:
            resp = Response(status=409)
            resp.headers["X-WOPI-Lock"]              = existing_lock.lock_string
            resp.headers["X-WOPI-LockFailureReason"] = "Already locked"
            return resp

        if existing_lock:
            existing_lock.lock_string = requested_lock
            existing_lock.locked_at   = now
        else:
            db.session.add(WopiLock(manuscript_id=file_id, lock_string=requested_lock))
        db.session.commit()

        resp = Response(status=200)
        resp.headers["X-WOPI-Lock"]              = requested_lock
        resp.headers["X-WOPI-LockFailureReason"] = ""
        resp.headers["X-WOPI-ItemVersion"]       = version_str
        return resp

    elif override == "UNLOCK":
        if existing_lock:
            if existing_lock.lock_string != requested_lock:
                resp = Response(status=409)
                resp.headers["X-WOPI-Lock"]              = existing_lock.lock_string
                resp.headers["X-WOPI-LockFailureReason"] = "Lock mismatch"
                return resp
            db.session.delete(existing_lock)
            db.session.commit()

        resp = Response(status=200)
        resp.headers["X-WOPI-Lock"]        = ""
        resp.headers["X-WOPI-ItemVersion"] = version_str
        return resp

    elif override == "REFRESH_LOCK":
        if not existing_lock or existing_lock.lock_string != requested_lock:
            resp = Response(status=409)
            resp.headers["X-WOPI-Lock"]              = existing_lock.lock_string if existing_lock else ""
            resp.headers["X-WOPI-LockFailureReason"] = "Lock mismatch or not locked"
            return resp

        existing_lock.locked_at = now
        db.session.commit()

        resp = Response(status=200)
        resp.headers["X-WOPI-Lock"] = existing_lock.lock_string
        return resp

    elif override == "GET_LOCK":
        resp = Response(status=200)
        resp.headers["X-WOPI-Lock"] = existing_lock.lock_string if existing_lock else ""
        return resp

    elif override == "UNLOCK_AND_RELOCK":
        if not existing_lock or existing_lock.lock_string != old_lock:
            resp = Response(status=409)
            resp.headers["X-WOPI-Lock"]              = existing_lock.lock_string if existing_lock else ""
            resp.headers["X-WOPI-LockFailureReason"] = "OldLock mismatch"
            return resp

        existing_lock.lock_string = requested_lock
        existing_lock.locked_at   = now
        db.session.commit()

        resp = Response(status=200)
        resp.headers["X-WOPI-Lock"] = requested_lock
        return resp

    elif override == "PUT_RELATIVE":
        return Response(status=501)

    return Response(status=501)


# ==========================
# TEMP DOWNLOAD TOKENS
# ==========================

@app.route("/api/manuscripts/temp-link/<int:manuscript_id>", methods=["POST"])
@jwt_required()
def create_temp_link(manuscript_id):
    db.session.get(Manuscript, manuscript_id)

    TempDownloadToken.query.filter(
        TempDownloadToken.expires_at < datetime.now(timezone.utc)
    ).delete()
    db.session.commit()

    token      = uuid.uuid4().hex + uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)

    db.session.add(TempDownloadToken(
        token=token, manuscript_id=manuscript_id, expires_at=expires_at
    ))
    db.session.commit()

    backend_url, _ = _get_urls()
    return jsonify({"temp_url": f"{backend_url}/uploads/temp/{token}", "expires_in": 60})


@app.route("/uploads/temp/<token>", methods=["GET"])
def serve_temp_file(token):
    temp = TempDownloadToken.query.filter_by(token=token).first()
    if not temp:
        return jsonify({"error": "Invalid or expired link"}), 404

    expires = temp.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        db.session.delete(temp)
        db.session.commit()
        return jsonify({"error": "Link expired. Please try again."}), 410

    manuscript = db.session.get(Manuscript, temp.manuscript_id)
    if not manuscript or not storage_exists(manuscript.filename):
        return jsonify({"error": "File not found"}), 404

    db.session.delete(temp)
    db.session.commit()

    ext = manuscript.name.rsplit(".", 1)[-1].lower() if "." in manuscript.name else ""
    mime = MIME_MAP.get(ext, "application/octet-stream")
    resp = Response(
        stream_with_context(storage_stream_bytes(manuscript.filename)),
        mimetype=mime,
    )
    resp.headers["Content-Disposition"] = f'attachment; filename="{manuscript.name}"'
    return resp


# ==========================
# AUTO MIGRATION
# Safely adds new columns to existing tables without dropping data.
# Runs on every deploy — uses IF NOT EXISTS so it's safe to re-run.
# ==========================

def run_migrations():
    """Add any missing columns to existing tables."""
    with app.app_context():
        db.create_all()  # Create any brand new tables

        # Run raw SQL migrations safely
        migrations = [
            # Add system_role column if it doesn't exist (added in v2)
            """
            ALTER TABLE "user"
            ADD COLUMN IF NOT EXISTS system_role VARCHAR(50) DEFAULT 'author';
            """,
            # Backfill existing users with default role
            """
            UPDATE "user"
            SET system_role = 'author'
            WHERE system_role IS NULL;
            """,
        ]

        try:
            with db.engine.connect() as conn:
                for sql in migrations:
                    conn.execute(db.text(sql.strip()))
                conn.commit()
            app.logger.info("✅ Database migrations applied successfully")
        except Exception as e:
            app.logger.warning(f"⚠️  Migration warning (non-fatal): {e}")


# Run migrations on startup (works for both gunicorn and direct run)
run_migrations()


# ==========================
# RUN SERVER
# ==========================

if __name__ == "__main__":
    app.run(port=5001, debug=True)
