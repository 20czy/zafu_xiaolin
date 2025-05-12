from fastapi import FastAPI
from app.api.v1 import chat, users

app = FastAPI(title="AI Chat Backend")

app.include_router(chat.router, prefix="/api/v1/chat")
app.include_router(users.router, prefix="/api/v1")
