#!/bin/sh
set -e

# Run migrations then start the app with Gunicorn.
# Railway sets $PORT automatically.

export FLASK_APP=app.py

cd "$(dirname "$0")"

# Ensure DB schema matches current SQLAlchemy models.
flask db upgrade

exec gunicorn -w "${GUNICORN_WORKERS:-2}" -b "0.0.0.0:${PORT}" app:app

