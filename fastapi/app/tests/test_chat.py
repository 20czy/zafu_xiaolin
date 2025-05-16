import pytest
import json
from unittest.mock import patch, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from ..schemas import chat as schemas
from ..api.v1.chat import generate_streaming_response, generate_standard_response


@pytest.mark.asyncio
async def test_chat_endpoint_streaming_response(client, mock_get_process_info, mock_response_generator, mock_chat_history_manager):
    """
    测试聊天接口的流式响应功能
    """
    # 准备请求数据
    request_data = {
        "message": "测试消息",
        "session_id": "test-session-id"
    }
    
    # 发送请求
    response = client.post("/api/v1/chat/", json=request_data)
    
    # 验证响应状态码
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream"
    
    # 解析流式响应内容
    content = response.content.decode("utf-8")
    events = [json.loads(line.strip().replace("data: ", "")) 
              for line in content.split("\n\n") 
              if line.strip() and line.startswith("data:")]
    
    # 验证响应内容
    assert len(events) > 0
    # 检查是否包含预期的事件类型
    event_types = [e.get("type") for e in events if "type" in e]
    assert "step" in event_types or "content" in events[0]


@pytest.mark.asyncio
async def test_chat_endpoint_standard_response(client, mock_chat_history_manager):
    """
    测试聊天接口的标准响应功能（当流式响应失败时的回退方案）
    """
    # 模拟流式响应失败
    async def mock_failing_generator(*args, **kwargs):
        raise Exception("Simulated streaming failure")
    
    # 准备请求数据
    request_data = {
        "message": "测试消息",
        "session_id": "test-session-id"
    }
    
    # 模拟流式响应失败，触发标准响应
    with patch('app.api.v1.chat.generate_streaming_response', return_value=mock_failing_generator):
        # 模拟标准响应
        with patch('app.api.v1.chat.generate_standard_response', new_callable=AsyncMock) as mock_standard_response:
            mock_standard_response.return_value = schemas.ChatResponse(
                status="success",
                data={"content": "Test standard response"}
            )
            
            # 发送请求
            response = client.post("/api/v1/chat/", json=request_data)
            
            # 验证响应状态码和内容
            assert response.status_code == 200
            assert response.json()["status"] == "success"
            assert response.json()["data"]["content"] == "Test standard response"
            
            # 验证标准响应函数被调用
            mock_standard_response.assert_called_once()


@pytest.mark.asyncio
async def test_chat_endpoint_validation_error(client):
    """
    测试聊天接口的输入验证
    """
    # 测试空消息
    request_data = {
        "message": "",
        "session_id": "test-session-id"
    }
    response = client.post("/api/v1/chat/", json=request_data)
    assert response.status_code == 200
    assert response.json()["status"] == "error"
    assert "消息内容和会话ID不能为空" in response.json()["message"]
    
    # 测试空会话ID
    request_data = {
        "message": "测试消息",
        "session_id": ""
    }
    response = client.post("/api/v1/chat/", json=request_data)
    assert response.status_code == 200
    assert response.json()["status"] == "error"
    assert "消息内容和会话ID不能为空" in response.json()["message"]


@pytest.mark.asyncio
async def test_chat_endpoint_server_error(client, mock_chat_history_manager):
    """
    测试聊天接口的服务器错误处理
    """
    # 准备请求数据
    request_data = {
        "message": "测试消息",
        "session_id": "test-session-id"
    }
    
    # 模拟ChatHistoryManager.get_chat_history抛出异常
    with patch('app.services.chat_history_manager.ChatHistoryManager.get_chat_history', 
               side_effect=Exception("Simulated server error")):
        # 发送请求
        response = client.post("/api/v1/chat/", json=request_data)
        
        # 验证响应状态码和内容
        assert response.status_code == 200
        assert response.json()["status"] == "error"
        assert "服务器内部错误" in response.json()["message"]


@pytest.mark.asyncio
async def test_generate_streaming_response():
    """
    测试generate_streaming_response函数
    """
    # 模拟数据
    message = "测试消息"
    session_id = "test-session-id"
    chat_history = [{"role": "user", "content": "Previous message"}]
    db = AsyncMock()
    
    # 模拟get_process_info
    async def mock_process_info(msg):
        yield {"type": "step", "content": "Test step"}
        yield {"type": "data", "subtype": "task_plan", "content": [{"id": "task1", "task": "Test"}]}
    
    # 模拟ResponseGenerator.create_streaming_response
    async def mock_streaming_response(msg, process_info, history):
        yield "Chunk 1"
        yield "Chunk 2"
    
    # 模拟ChatHistoryManager.save_message
    async def mock_save_message(session_id, content, is_user, db):
        mock_msg = AsyncMock()
        mock_msg.id = 1
        return mock_msg
    
    # 模拟ChatHistoryManager.save_process_info
    async def mock_save_process_info(message_id, session_id, process_info, db):
        return AsyncMock()
    
    with patch('app.api.v1.chat.get_process_info', return_value=mock_process_info(message)), \
         patch('app.agent.ResponseGenerator.ResponseGenerator.create_streaming_response', 
               return_value=mock_streaming_response(message, {}, chat_history)), \
         patch('app.services.chat_history_manager.ChatHistoryManager.save_message', 
               side_effect=mock_save_message), \
         patch('app.services.chat_history_manager.ChatHistoryManager.save_process_info', 
               side_effect=mock_save_process_info):
        
        # 调用函数并收集结果
        generator = generate_streaming_response(message, session_id, chat_history, db)
        results = []
        async for chunk in generator:
            results.append(chunk)
        
        # 验证结果
        assert len(results) > 0
        assert any(b'Test step' in r.encode('utf-8') for r in results)
        assert any(b'Chunk' in r.encode('utf-8') for r in results)


@pytest.mark.asyncio
async def test_generate_standard_response():
    """
    测试generate_standard_response函数
    """
    # 模拟数据
    message = "测试消息"
    session_id = "test-session-id"
    chat_history = [{"role": "user", "content": "Previous message"}]
    db = AsyncMock()
    
    # 模拟get_process_info
    async def mock_process_info(msg):
        yield {"type": "step", "content": "Test step"}
        yield {"type": "data", "subtype": "task_plan", "content": [{"id": "task1", "task": "Test"}]}
    
    # 模拟ResponseGenerator.create_response
    async def mock_create_response(msg, process_info, history):
        return "Test standard response"
    
    # 模拟ChatHistoryManager.save_message
    async def mock_save_message(session_id, content, is_user, db):
        mock_msg = AsyncMock()
        mock_msg.id = 1
        return mock_msg
    
    # 模拟ChatHistoryManager.save_process_info
    async def mock_save_process_info(message_id, session_id, process_info, db):
        return AsyncMock()
    
    with patch('app.api.v1.chat.get_process_info', return_value=mock_process_info(message)), \
         patch('app.agent.ResponseGenerator.ResponseGenerator.create_response', 
               side_effect=mock_create_response), \
         patch('app.services.chat_history_manager.ChatHistoryManager.save_message', 
               side_effect=mock_save_message), \
         patch('app.services.chat_history_manager.ChatHistoryManager.save_process_info', 
               side_effect=mock_save_process_info):
        
        # 调用函数
        response = await generate_standard_response(message, session_id, chat_history, db)
        
        # 验证结果
        assert response.status == "success"
        assert response.data["content"] == "Test standard response"