from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from .models import PDFDocument


def process_pdf_document(document_id):
    """
    从数据库获取PDF文件并进行处理
    
    Args:
        document_id: PDFDocument模型的ID
    
    Returns:
        list: 处理后的文档块列表
    """
    try:
        # 从数据库获取PDF文档
        pdf_doc = PDFDocument.objects.get(id=document_id)
        
        # 获取PDF文件的完整路径
        pdf_path = pdf_doc.file.path
        
        # 使用PyPDFLoader加载PDF
        loader = PyPDFLoader(pdf_path)
        pages = loader.load()
        
        # 配置文本分割器
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,  # 每个块的最大字符数
            chunk_overlap=200,  # 块之间的重叠字符数
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )
        
        # 分割文档
        docs = text_splitter.split_documents(pages)
        
        return docs
        
    except PDFDocument.DoesNotExist:
        raise Exception(f"未找到ID为 {document_id} 的PDF文档")
    except Exception as e:
        raise Exception(f"处理PDF文档时发生错误: {str(e)}")

def get_pdf_text(document_id):
    """
    获取PDF文档的完整文本内容
    
    Args:
        document_id: PDFDocument模型的ID
    
    Returns:
        str: PDF文档的完整文本内容
    """
    try:
        docs = process_pdf_document(document_id)
        return "\n\n".join([doc.page_content for doc in docs])
    except Exception as e:
        raise Exception(f"获取PDF文本时发生错误: {str(e)}")

