from openai import OpenAI
from typing import List

class ChatBot:
    def __init__(self, api_key: str):
        self.client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )
        self.messages: List[dict] = []
    
    def add_message(self, role: str, content: str):
        """添加消息到对话历史"""
        self.messages.append({"role": role, "content": content})
    
    def chat(self, user_input: str) -> str:
        """与AI进行对话"""
        self.add_message("user", user_input)
        
        try:
            # 调用 Deepseek API
            response = self.client.chat.completions.create(
                model="deepseek-chat",
                messages=self.messages,
                stream=True  # 启用流式响应
            )
            
            # 处理流式响应
            full_response = ""
            for chunk in response:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    # 实时打印每个文字（可选）
                    print(content, end="", flush=True)
            
            # 将完整回复添加到消息历史
            self.add_message("assistant", full_response)
            return full_response
            
        except Exception as e:
            return f"发生错误: {str(e)}"

def main():
    # 将环境变量替换为你的API密钥
    api_key = "sk-00f4fba669114e778ac4f67f310436db"
    
    # 创建聊天机器人实例
    chatbot = ChatBot(api_key)
    
    print("欢迎使用AI聊天程序！输入'退出'结束对话。")
    
    while True:
        user_input = input("\n你: ")
        if user_input.lower() in ['退出', 'quit', 'exit']:
            break
            
        response = chatbot.chat(user_input)
        print(f"\nAI: {response}")

if __name__ == "__main__":
    main()
