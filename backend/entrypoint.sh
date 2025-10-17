#!/bin/bash
set -e

# Wait for database to start
echo "Waiting for database to start..."

# Use Python to check database connectivity instead of nc
until python -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.connect(('$DB_HOST', int($DB_PORT))); s.close()" 2>/dev/null
do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is up - continuing"

# Change to the correct directory
cd /app

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Start Django
python manage.py runserver 0.0.0.0:8000