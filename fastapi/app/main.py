from contextlib import asynccontextmanager

from fastapi import FastAPI
from app.api.v1 import agent_data, campus_notice, capabilities, chat, course_schedule, student_profile, users
from app.api import demo
from app.db.models import Base
from app.db.session import engine
from fastapi.middleware.cors import CORSMiddleware
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


app = FastAPI(title="XiaoLin Demo Backend", lifespan=lifespan)

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
app.include_router(agent_data.router, prefix="/api/v1/agent-data")
app.include_router(course_schedule.router, prefix="/api/v1/course-schedule")
app.include_router(campus_notice.router, prefix="/api/v1/campus-notices")
app.include_router(capabilities.router, prefix="/api/v1/capabilities")
app.include_router(student_profile.router, prefix="/api/v1/student-profile")
app.include_router(demo.router, prefix="/api")
