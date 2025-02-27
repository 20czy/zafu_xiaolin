import unittest
import logging
from backend.chatbot.documentProcess import get_pdf_text
from backend.chatbot.models import PDFDocument

# 配置日志记录
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TestDocumentLoader(unittest.TestCase):
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

    def test_pdf_loading(self):
        """测试PDF加载功能"""
        try:
            logger.info("开始测试PDF加载...")
            
            # 获取原始PDF文本内容
            raw_text = get_pdf_text(self.test_doc.id)
            
            # 保存原始内容到文件
            raw_output_file = "raw_pdf_content.txt"
            with open(raw_output_file, "w", encoding="utf-8", errors="ignore") as f:
                cleaned_raw_text = raw_text.encode('utf-8', errors='ignore').decode('utf-8')
                f.write(cleaned_raw_text)
            
            logger.info(f"已将原始PDF内容保存到文件: {raw_output_file}")
            
            # 验证文本不为空
            self.assertIsNotNone(raw_text)
            self.assertTrue(len(raw_text) > 0)
            
            # 预览文本内容
            preview_length = min(200, len(raw_text))
            logger.info(f"文本预览 (前{preview_length}个字符):\n{raw_text[:preview_length]}...")
            
        except Exception as e:
            logger.error(f"PDF加载测试失败: {str(e)}")
            raise

if __name__ == '__main__':
    unittest.main()