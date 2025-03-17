import os
import django
import logging

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from backend.chatbot.PDFdocument.documentSearch import search_all_documents, search_session_documents
from chatbot.models import ChatSession

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_search():
    """测试文档检索功能"""
    while True:
        print("\n=== 文档检索测试程序 ===")
        print("1. 搜索所有文档")
        print("2. 搜索特定会话文档")
        print("3. 退出")
        
        choice = input("请选择功能 (1-3): ")
        
        if choice == "3":
            break
            
        query = input("请输入查询内容: ")
        
        try:
            if choice == "1":
                results = search_all_documents(query)
                print(f"\n找到 {len(results)} 条相关内容:")
                for i, result in enumerate(results, 1):
                    print(f"\n--- 结果 {i} ---")
                    print(f"文档: {result['document_title']}")
                    print(f"相似度: {result['score']}")
                    print(f"内容: {result['content'][:200]}...")
                    
            elif choice == "2":
                session_id = input("请输入会话ID: ")
                try:
                    session_id = int(session_id)
                    # 验证会话是否存在
                    ChatSession.objects.get(id=session_id)
                    
                    results = search_session_documents(query, session_id)
                    print(f"\n找到 {len(results)} 条相关内容:")
                    for i, result in enumerate(results, 1):
                        print(f"\n--- 结果 {i} ---")
                        print(f"文档: {result['document_title']}")
                        print(f"相似度: {result['score']}")
                        print(f"内容: {result['content'][:200]}...")
                        
                except ValueError:
                    print("无效的会话ID")
                except ChatSession.DoesNotExist:
                    print(f"会话 {session_id} 不存在")
            
        except Exception as e:
            print(f"搜索出错: {str(e)}")

if __name__ == "__main__":
    test_search()