import os

# Django API configuration
DJANGO_API_BASE_URL = os.getenv("DJANGO_API_BASE_URL", "http://localhost:8000/api/chat/sessions")