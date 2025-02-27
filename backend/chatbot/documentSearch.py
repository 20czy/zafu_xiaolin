from typing import List, Dict
import os
from langchain_community.vectorstores import FAISS
from .documentEmbedding import ZhipuAIEmbeddings, load_faiss_index
from .models import PDFDocument
import logging
from .models import ChatSession

logger = logging.getLogger(__name__)

TOP_K = 3

class DocumentRetriever:
    """文档检索器类"""
    
    def __init__(self, document_id: int, top_k: int = TOP_K):
        """
        初始化文档检索器
        
        Args:
            document_id: PDF文档ID
            top_k: 返回的相关文档数量
        """
        self.document_id = document_id
        self.top_k = top_k
        self.vectorstore = self._load_vectorstore()
    
    def _load_vectorstore(self):
        """加载向量存储"""
        try:
            # 从数据库获取文档
            pdf_doc = PDFDocument.objects.get(id=self.document_id)
            if not pdf_doc.vector_index_path:
                raise ValueError(f"文档 {self.document_id} 未创建向量索引")
                
            # 检查向量存储文件是否存在
            if not os.path.exists(pdf_doc.vector_index_path):
                raise FileNotFoundError(f"向量存储文件不存在: {pdf_doc.vector_index_path}")
                
            # 使用 load_faiss_index 函数
            logger.info(f"加载向量存储: {pdf_doc.vector_index_path}")
            return load_faiss_index(pdf_doc.vector_index_path)
            
        except PDFDocument.DoesNotExist:
            logger.error(f"未找到ID为 {self.document_id} 的文档")
            raise ValueError(f"未找到ID为 {self.document_id} 的文档")
        except Exception as e:
            logger.error(f"加载向量存储时发生错误: {str(e)}")
            raise Exception(f"加载向量存储时发生错误: {str(e)}")
    
    def retrieve(self, query_embedding: List[float]) -> List[Dict]:
        """
        检索与查询相关的文档内容
        
        Args:
            query_embedding: 用户查询文本的向量
            
        Returns:
            相关文档内容列表
        """
        try:
            # 使用向量存储进行相似度搜索
            docs_with_score = self.vectorstore.similarity_search_with_score_by_vector(query_embedding, k=self.top_k)
            
            # 提取文档内容和元数据
            results = []
            for doc, score in docs_with_score:
                results.append({
                    'content': doc.page_content,
                    'metadata': doc.metadata,
                    'score': score  # 如果有相似度分数的话
                })
            logger.info(f"检索到 {len(results)} 条结果")
            logger.info(f"检索结果: {results}")
            return results
            
        except Exception as e:
            logger.error(f"在执行retrieve操作时,检索过程中发生错误: {str(e)}")
            raise Exception(f"检索过程中发生错误: {str(e)}")
        
def query_embedding(query: str) -> List[float]:
    """获取查询文本的向量"""
    embeddings = ZhipuAIEmbeddings()
    return embeddings.embed_query(query)

def get_document_retriever(document_id: int, top_k: int = 3) -> DocumentRetriever:
    """
    创建文档检索器实例
    
    Args:
        document_id: PDF文档ID
        top_k: 返回的相关文档数量
        
    Returns:
        DocumentRetriever实例
    """
    return DocumentRetriever(document_id, top_k)

def search_document(document_id: int, query: str, top_k: int = 3) -> List[Dict]:
    """
    搜索文档内容的便捷函数
    
    Args:
        document_id: PDF文档ID
        query: 查询文本
        top_k: 返回的相关文档数量
        
    Returns:
        List[Dict]: 相关文档内容列表
    """
    # 获取查询向量
    query_vec = query_embedding(query)
    retriever = get_document_retriever(document_id, top_k)
    return retriever.retrieve(query_vec)

def search_all_documents(query: str, top_k: int = 3) -> List[Dict]:
    """
    搜索所有文档内容
    
    Args:
        query: 查询文本
        top_k: 每个文档返回的相关内容数量
        
    Returns:
        相关文档内容列表
    """
    logger.info(f"input query of search_all_documents: {query}")
    try:
        # 获取所有已处理的文档
        processed_docs = PDFDocument.objects.filter(is_processed=True)
        if not processed_docs.exists():
            logger.info("没有找到已处理的文档")
            return []

        # 获取查询向量 - 只调用一次embedding
        query_vec = query_embedding(query)
        
        # 合并所有文档的检索结果
        all_results = []
        for doc in processed_docs:
            try:
                retriever = DocumentRetriever(doc.id, top_k)
                results = retriever.retrieve(query_vec)
                # 添加文档标题到结果中
                for result in results:
                    result['document_title'] = doc.title
                all_results.extend(results)
            except Exception as e:
                logger.warning(f"检索文档 {doc.id} 时出错: {str(e)}")
                continue
        
        # 按相似度分数排序（如果有分数的话）
        all_results.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        # 返回总体最相关的 top_k 个结果
        return all_results[:top_k]
        
    except Exception as e:
        logger.error(f"搜索所有文档时发生错误: {str(e)}")
        raise Exception(f"搜索所有文档时发生错误: {str(e)}")

def search_session_documents(query: str, session_id: int, document_type: str = None, top_k: int = 3) -> List[Dict]:
    """
    搜索特定会话关联的所有文档内容
    
    Args:
        query: 查询文本
        session_id: 会话ID
        top_k: 返回的相关文档数量
        document_type: 文档类型，可选值为 "invitation" 或 "offer"
        
    Returns:
        相关文档内容列表
    """
    logger.info(f"搜索会话 {session_id} 的文档, 类型为 {document_type}")
    try:
        # 获取会话相关的已处理文档
        chat_session = ChatSession.objects.get(id=session_id)
        query_filter = {
            'session': chat_session,
            'is_processed': True
        }

        if document_type in ['invitation', 'offer']:
            query_filter['document_type'] = document_type

        processed_docs = PDFDocument.objects.filter(**query_filter)

        if not processed_docs.exists():
            logger.info(f"会话 {session_id} 没有找到已处理的文档")
            return []

        # 获取查询向量 - 只调用一次embedding
        query_vec = query_embedding(query)
        
        # 合并所有文档的检索结果
        all_results = []
        for doc in processed_docs:
            try:
                retriever = DocumentRetriever(doc.id, top_k)
                results = retriever.retrieve(query_vec)
                # 添加文档标题和类型到结果中
                for result in results:
                    result['document_title'] = doc.title
                    result['document_type'] = '招标文件' if doc.DOCUMENT_TYPES == 'invitation' else '投标文件'
                all_results.extend(results)
            except Exception as e:
                logger.warning(f"检索文档 {doc.id} 时出错: {str(e)}")
                continue
        
        # 按相似度分数排序
        all_results.sort(key=lambda x: x.get('score', 0), reverse=True)
        
        # 返回总体最相关的 top_k 个结果
        final_results = all_results[:top_k]
        logger.info(f"找到 {len(final_results)} 条相关内容")
        return final_results
        
    except ChatSession.DoesNotExist:
        logger.error(f"会话 {session_id} 不存在")
        return []
    except Exception as e:
        logger.error(f"搜索会话文档时发生错误: {str(e)}")
        raise Exception(f"搜索会话文档时发生错误: {str(e)}")