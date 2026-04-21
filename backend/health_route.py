# ==========================
# ADD THIS ROUTE TO app.py
# Place it right after the app = Flask(__name__) block
# Railway uses this to check if the backend is alive
# ==========================

@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200
