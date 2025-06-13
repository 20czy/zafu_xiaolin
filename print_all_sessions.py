#!/usr/bin/env python
"""
直接调用session_messages API获取所有会话消息并打印到控制台
"""
import os
import sys
import django

# 设置Django环境
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.http import HttpRequest
from django.contrib.auth import get_user_model
from backend.chatbot.models import ChatSession
from backend.chatbot.views import session_messages

User = get_user_model()

def main():
    """获取并打印所有会话的消息"""
    # 创建请求对象
    request = HttpRequest()
    
    # 使用第一个用户
    user = User.objects.first()
    if user:
        request.user = user
        print(f"使用用户: {user.username}")
    else:
        print("警告: 未找到用户")
        return
    
    # 设置请求方法
    request.method = 'GET'
    
    # 获取所有会话
    sessions = ChatSession.objects.all()
    if not sessions:
        print("没有找到任何会话")
        return
        
    print(f"找到 {sessions.count()} 个会话")
    
    # 遍历每个会话并获取消息
    for session in sessions:
        print(f"\n\n==== 会话ID: {session.id}, 标题: {session.title} ====")
        response = session_messages(request, session.id)
        
        if hasattr(response, 'data'):
            data = response.data
            
            if 'data' in data:
                messages = data['data']
                print(f"消息数量: {len(messages)}")
                
                for i, msg in enumerate(messages):
                    print(f"\n消息 {i+1}:")
                    print(f"内容: {msg.get('content')}")
                    print(f"是否用户消息: {msg.get('is_user')}")
                    print(f"创建时间: {msg.get('created_at')}")
                    
                    if 'process_info' in msg:
                        print("\n处理信息:")
                        process_info = msg['process_info']
                        print(f"步骤: {process_info.get('steps')}")
                        print(f"任务计划: {process_info.get('task_plan')}")
                        print(f"工具选择: {process_info.get('tool_selection')}")
                        print(f"任务结果: {process_info.get('task_results')}")
                        print(f"创建时间: {process_info.get('created_at')}")
            else:
                print(f"响应: {data}")
        else:
            print(f"响应内容: {response.content}")

if __name__ == "__main__":
    main()
