from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from app.api.v1 import agent_data, auth, campus_notice, capabilities, chat, course_schedule, student_profile, venues
from app.api import demo
from app.db.models import Base
from app.db.session import engine
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.services.access_service import authenticate_request
from app.db.session import async_session
import os
import logging
from logging.handlers import RotatingFileHandler

# 确保日志目录存在
os.makedirs("logs", exist_ok=True)

# 设置日志格式
log_formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# 创建文件日志处理器（每个日志文件最大5MB，最多保留5个备份）
file_handler = RotatingFileHandler(
    "logs/app.log", maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
)
file_handler.setFormatter(log_formatter)
file_handler.setLevel(logging.INFO)

# 创建控制台日志处理器
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
console_handler.setLevel(logging.INFO)

# 获取主 logger，并添加处理器
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 避免重复添加处理器（例如在热重载中）
if not logger.hasHandlers():
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="XiaoLin Demo Backend",
    lifespan=lifespan,
    docs_url=None if os.getenv("ENABLE_API_DOCS", "false").lower() != "true" else "/docs",
    redoc_url=None,
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")],
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法
    allow_headers=["*"],  # 允许所有头部
)


@app.middleware("http")
async def require_trial_access(request, call_next):
    public_paths = {"/api/v1/auth/login", "/api/v1/auth/logout", "/health"}
    if request.url.path.startswith("/api/") and request.url.path not in public_paths:
        internal_token = os.getenv("INTERNAL_API_TOKEN", "")
        if not internal_token or request.headers.get("X-Internal-Token") != internal_token:
            try:
                async with async_session() as db:
                    request.state.access = await authenticate_request(request, db)
            except HTTPException as exc:
                return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return await call_next(request)


@app.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(chat.router, prefix="/api/v1/chat")
app.include_router(auth.router, prefix="/api/v1/auth")
app.include_router(agent_data.router, prefix="/api/v1/agent-data")
app.include_router(course_schedule.router, prefix="/api/v1/course-schedule")
app.include_router(campus_notice.router, prefix="/api/v1/campus-notices")
app.include_router(capabilities.router, prefix="/api/v1/capabilities")
app.include_router(student_profile.router, prefix="/api/v1/student-profile")
app.include_router(venues.router, prefix="/api/v1/venues")
app.include_router(demo.router, prefix="/api")
