from langchain.embeddings.base import Embeddings
from langchain.vectorstores import FAISS
from typing import List, Dict
import os
from zhipuai import ZhipuAI
import logging

logger = logging.getLogger(__name__)

class ZhipuAIEmbeddings(Embeddings):
    """自定义智谱AI的Embeddings类"""
    
    def __init__(self):
        """初始化智谱AI Embeddings"""
        api_key = os.getenv("ZHIPUAI_API_KEY")
        if not api_key:
            raise ValueError("未设置 ZHIPUAI_API_KEY 环境变量")
        
        self.client = ZhipuAI(api_key=api_key)
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """批量获取文档向量"""
        results = []
        for text in texts:
            try:
                response = self.client.embeddings.create(
                    model="embedding-3",
                    input=text
                )
                results.append(response.data[0].embedding)
            except Exception as e:
                raise Exception(f"获取文档向量失败: {str(e)}")
        return results
    
    def embed_query(self, text: str) -> List[float]:
        """获取单个查询文本的向量"""
        logger.info(f"查询文本(query): {text}")
        try:
            response = self.client.embeddings.create(
                model="embedding-3",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"获取查询向量失败: {str(e)}")
            raise Exception(f"获取查询向量失败: {str(e)}")

def add_documents_to_faiss(docs: List[Dict], index_path: str = "document_index.faiss"):
    """
    将文档添加到FAISS向量存储中
    
    Args:
        docs: 文档列表
        index_path: 向量存储保存路径
    
    Returns:
        FAISS: 向量存储实例
    """
    try:
        embeddings = ZhipuAIEmbeddings()
        texts = [doc.page_content for doc in docs]
        
        vectorstore = FAISS.from_texts(
            texts=texts,
            embedding=embeddings
        )
        
        vectorstore.save_local(index_path)
        return vectorstore
        
    except Exception as e:
        raise Exception(f"创建向量存储时发生错误: {str(e)}")

def load_faiss_index(index_path: str) -> FAISS:
    """
    加载FAISS向量索引
    
    Args:
        index_path: 向量索引文件路径
        
    Returns:
        FAISS向量存储实例
    """
    try:
        embeddings = ZhipuAIEmbeddings()
        return FAISS.load_local(
            index_path, 
            embeddings,
            allow_dangerous_deserialization=True
        )
    except Exception as e:
        logger.error(f"加载向量索引失败: {str(e)}")
        raise Exception(f"加载向量索引失败: {str(e)}")