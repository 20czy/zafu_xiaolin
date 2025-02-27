import unittest
import logging
from backend.chatbot.documentProcess import process_pdf_document
from backend.chatbot.models import PDFDocument

# 配置日志记录
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TestProcessPDFDocument(unittest.TestCase):
    def setUp(self):
        # 获取测试数据库中的第一个PDF文档
        try:
            self.test_doc = PDFDocument.objects.first()
            if not self.test_doc:
                logger.error("测试数据库中没有找到PDF文档")
                raise unittest.SkipTest("没有可用的测试文档")
            logger.info(f"使用测试文档: ID={self.test_doc.id}, 文件名={self.test_doc.file.name}")
        except Exception as e:
            logger.error(f"设置测试环境时出错: {str(e)}")
            raise

    def test_recursive_split(self):
        """测试递归分割方法"""
        try:
            logger.info("开始测试递归分割方法...")
            docs = process_pdf_document(
                self.test_doc.id,
                split_method="recursive",
                chunk_size=1000,
                chunk_overlap=200
            )
            logger.info(f"递归分割完成，生成了 {len(docs)} 个文档块")
            for i, doc in enumerate(docs[:3], 1):  # 只记录前3个块的内容
                logger.info(f"文档块 {i} 预览: {doc.page_content[:100]}...")
        except Exception as e:
            logger.error(f"递归分割测试失败: {str(e)}")
            raise

    def test_llm_split(self):
        """测试LLM分割方法"""
        try:
            logger.info("开始测试LLM分割方法...")
            docs = process_pdf_document(
                self.test_doc.id,
                split_method="llm",
                chunk_size=1000,
                chunk_overlap=200,
                model_name="chatglm"
            )
            logger.info(f"LLM分割完成，生成了 {len(docs)} 个文档块")
            for i, doc in enumerate(docs[:3], 1):
                logger.info(f"文档块 {i} 预览: {doc.page_content[:100]}...")
        except Exception as e:
            logger.error(f"LLM分割测试失败: {str(e)}")
            raise

    def test_embedding_split(self):
        """测试嵌入分割方法"""
        try:
            logger.info("开始测试嵌入分割方法...")
            docs = process_pdf_document(
                self.test_doc.id,
                split_method="embedding",
                chunk_size=1000,
                chunk_overlap=200
            )
            logger.info(f"嵌入分割完成，生成了 {len(docs)} 个文档块")
            for i, doc in enumerate(docs[:3], 1):
                logger.info(f"文档块 {i} 预览: {doc.page_content[:100]}...")
        except Exception as e:
            logger.error(f"嵌入分割测试失败: {str(e)}")
            raise

    def test_different_chunk_sizes(self):
        """测试不同的块大小"""
        try:
            logger.info("测试不同的块大小...")
            chunk_sizes = [500, 1000, 2000]
            for size in chunk_sizes:
                docs = process_pdf_document(
                    self.test_doc.id,
                    chunk_size=size,
                    chunk_overlap=100
                )
                logger.info(f"块大小 {size}: 生成了 {len(docs)} 个文档块")
        except Exception as e:
            logger.error(f"块大小测试失败: {str(e)}")
            raise

if __name__ == '__main__':
    unittest.main()