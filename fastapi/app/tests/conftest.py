# import pytest
# from fastapi.testclient import TestClient
# from sqlalchemy import create_engine
# from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
# from sqlalchemy.orm import sessionmaker
# from unittest.mock import AsyncMock, patch, MagicMock
# import asyncio
# import os
# from dotenv import load_dotenv
# from ..db.session import get_db
# from ..db.models import Base
# from ..main import app
# from ..agent.LLMController import get_process_info
# from ..agent.ResponseGenerator import ResponseGenerator
# from ..services.chat_history_manager import ChatHistoryManager

# # 加载环境变量
# load_dotenv()

# # 使用PostgreSQL数据库进行测试
# # 创建一个专用的测试数据库名称，避免影响生产数据
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://charn:123456@localhost:5432/mydb")
# TEST_DATABASE_URL = DATABASE_URL.replace("/mydb", "/test_mydb")

# # 创建异步引擎
# async_engine = create_async_engine(TEST_DATABASE_URL)
# TestingSessionLocal = sessionmaker(class_=AsyncSession, expire_on_commit=False, bind=async_engine)

# # 创建同步引擎用于创建表
# sync_engine = create_engine(TEST_DATABASE_URL.replace("+asyncpg", ""))

# @pytest.fixture(scope="session", autouse=True)
# def setup_test_database():
#     """设置测试数据库"""
#     # 创建表
#     Base.metadata.drop_all(bind=sync_engine)  # 确保表是干净的
#     Base.metadata.create_all(bind=sync_engine)
#     yield
#     # 测试完成后清理
#     Base.metadata.drop_all(bind=sync_engine)

# # Override the get_db dependency with async version
# @pytest.fixture
# async def override_get_db():
#     async with TestingSessionLocal() as session:
#         yield session

# @pytest.fixture
# def client(override_get_db):
#     app.dependency_overrides[get_db] = lambda: override_get_db
#     with TestClient(app) as client:
#         yield client
#     app.dependency_overrides.clear()

# # Mock for get_process_info
# @pytest.fixture
# def mock_get_process_info():
#     async def mock_process_info_generator(message):
#         yield {"type": "step", "content": "Planning tasks..."}
#         yield {"type": "data", "subtype": "task_plan", "content": [
#             {"id": "task1", "task": "Test task", "input": message}
#         ]}
#         yield {"type": "step", "content": "Selecting tools..."}
#         yield {"type": "data", "subtype": "tool_selections", "content": {
#             "task1": {"tool": "general_assistant", "params": {"query_type": "general"}}
#         }}
#         yield {"type": "step", "content": "Executing task: Test task..."}
#         yield {"type": "data", "subtype": "task_result", "content": {
#             "task_id": "task1", 
#             "result": {"status": "success", "content": "Test response"}
#         }}
    
#     with patch('app.api.v1.chat.get_process_info', return_value=mock_process_info_generator):
#         yield

# # Mock for ResponseGenerator
# @pytest.fixture
# def mock_response_generator():
#     async def mock_create_streaming_response(message, process_info, chat_history=None):
#         yield "Test streaming response chunk 1"
#         yield "Test streaming response chunk 2"
    
#     async def mock_create_response(message, process_info, chat_history=None):
#         return "Test standard response"
    
#     with patch.object(ResponseGenerator, 'create_streaming_response', 
#                      return_value=mock_create_streaming_response), \
#          patch.object(ResponseGenerator, 'create_response', 
#                      side_effect=mock_create_response):
#         yield

# # Mock for ChatHistoryManager
# @pytest.fixture
# def mock_chat_history_manager():
#     async def mock_save_message(session_id, content, is_user, db):
#         mock_message = MagicMock()
#         mock_message.id = 1
#         return mock_message
    
#     async def mock_get_chat_history(session_id, db):
#         return [
#             {"role": "user", "content": "Previous message"},
#             {"role": "assistant", "content": "Previous response"}
#         ]
    
#     async def mock_save_process_info(message_id, session_id, process_info, db):
#         return MagicMock()
    
#     with patch.object(ChatHistoryManager, 'save_message', side_effect=mock_save_message), \
#          patch.object(ChatHistoryManager, 'get_chat_history', side_effect=mock_get_chat_history), \
#          patch.object(ChatHistoryManager, 'save_process_info', side_effect=mock_save_process_info):
#         yield