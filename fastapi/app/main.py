from fastapi import FastAPI
from app.api.v1 import chat, users
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Chat Backend")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境中应该限制为前端URL
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头部
)

app.include_router(chat.router, prefix="/api/v1/chat")
app.include_router(users.router, prefix="/api/v1")
