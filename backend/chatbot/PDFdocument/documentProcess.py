from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from ..models import PDFDocument
from ..LLMService import create_llm
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import CommaSeparatedListOutputParser
from .documentEmbedding import ZhipuAIEmbeddings


def clean_text(text):
    """清理文本中的无效字符"""
    # 移除或替换无效的 Unicode 字符
    cleaned_text = text.encode('utf-8', errors='ignore').decode('utf-8')
    # 或者使用更保守的方式，将无效字符替换为问号
    # cleaned_text = text.encode('utf-8', errors='replace').decode('utf-8')
    return cleaned_text

def create_text_splitter(chunk_size=1000, chunk_overlap=200):
    """
    创建标准文本分割器
    
    Args:
        chunk_size: 每个块的最大字符数
        chunk_overlap: 块之间的重叠字符数
    
    Returns:
        RecursiveCharacterTextSplitter 对象
    """
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )

def create_llm_splitter(model_name="chatglm"):
    """
    创建基于LLM的语义分割器
    
    Args:
        llm_model: 使用的语言模型名称
    
    Returns:
        一个函数，接受文本并返回分割后的文档块
    """
    llm = create_llm(model_name=model_name)
    
    # 创建提示模板，指导LLM如何分割文本
    prompt_template = """
    请分析以下文本并将其分割成有语义连贯性的段落。
    考虑文本的自然语义边界，如主题变化、段落结构、逻辑单元等。
    
    文本:
    {text}
    
    请返回推荐的分割点（字符索引），用逗号分隔。这些索引应该标记不同语义单元之间的边界：
    """
    
    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["text"]
    )
    
    parser = CommaSeparatedListOutputParser()
    
    def split_text(text, max_length=4000):
        """
        使用LLM分割较长文本
        
        Args:
            text: 要分割的文本
            max_length: LLM处理的最大文本长度
        
        Returns:
            list: 分割后的文本块列表
        """
        # 如果文本太长，先进行粗略分割
        if len(text) > max_length:
            initial_chunks = [text[i:i+max_length] for i in range(0, len(text), max_length)]
            result_chunks = []
            
            for chunk in initial_chunks:
                result_chunks.extend(split_text(chunk, max_length))
            
            return result_chunks
        
        try:
            # 调用LLM获取分割点
            chain = prompt | llm | parser
            split_indices = chain.invoke({"text": text})
            
            # 将字符串索引转换为整数
            indices = [int(idx.strip()) for idx in split_indices if idx.strip().isdigit()]
            indices.sort()
            
            # 根据索引分割文本
            chunks = []
            start_idx = 0
            
            for idx in indices:
                if idx > start_idx and idx < len(text):
                    chunks.append(text[start_idx:idx])
                    start_idx = idx
            
            # 添加最后一个块
            if start_idx < len(text):
                chunks.append(text[start_idx:])
            
            return chunks
        except Exception as e:
            # 如果LLM分割失败，返回整个文本作为一个块
            print(f"LLM分割失败: {str(e)}")
            return [text]
    
    return split_text

def create_embedding_splitter(chunk_size=1000, chunk_overlap=200):
    """
    创建基于嵌入的语义分割器
    
    此函数使用嵌入模型来计算文本块之间的语义相似度，
    并在语义边界处进行分割。
    
    Args:
        chunk_size: 每个块的最大字符数
        chunk_overlap: 块之间的重叠字符数
    
    Returns:
        一个函数，可以根据语义相似度分割文档
    """
    # 使用标准分割器进行初始分割
    base_splitter = create_text_splitter(chunk_size, chunk_overlap)
    embeddings = ZhipuAIEmbeddings()
    
    def split_by_embeddings(docs):
        """
        使用嵌入模型对文档进行语义分割
        
        Args:
            docs: 要处理的文档列表
        
        Returns:
            list: 按语义重新组织的文档列表
        """
        # 先使用基础分割器获取初始块
        chunks = base_splitter.split_documents(docs)
        
        if len(chunks) <= 1:
            return chunks
        
        try:
            # 获取每个块的嵌入向量
            texts = [chunk.page_content for chunk in chunks]
            text_embeddings = embeddings.embed_documents(texts)
            
            # 计算相邻块之间的相似度
            # 使用numpy计算余弦相似度
            def cosine_similarity(A, B):
                dot_product = np.dot(A, B)
                norm_A = np.linalg.norm(A)
                norm_B = np.linalg.norm(B)
                return dot_product / (norm_A * norm_B)
            import numpy as np
            
            # 计算相邻文本块之间的余弦相似度
            similarities = []
            for i in range(len(text_embeddings) - 1):
                sim = cosine_similarity(
                    [text_embeddings[i]], 
                    [text_embeddings[i+1]]
                )[0][0]
                similarities.append(sim)
            
            # 设置相似度阈值，低于此值表示语义变化
            threshold = np.mean(similarities) - 0.5 * np.std(similarities)
            
            # 根据相似度重新组织文档块
            result_chunks = []
            current_text = chunks[0].page_content
            current_metadata = chunks[0].metadata.copy()
            
            for i in range(len(similarities)):
                if similarities[i] < threshold:
                    # 在此处分割，创建新文档
                    new_doc = chunks[0].model_copy()
                    new_doc.page_content = current_text
                    new_doc.metadata = current_metadata
                    result_chunks.append(new_doc)
                    
                    # 开始新的文档块
                    current_text = chunks[i+1].page_content
                    current_metadata = chunks[i+1].metadata.copy()
                else:
                    # 合并文本块
                    current_text += "\n" + chunks[i+1].page_content
            
            # 添加最后一个文档块
            if current_text:
                last_doc = chunks[0].model_copy()
                last_doc.page_content = current_text
                last_doc.metadata = current_metadata
                result_chunks.append(last_doc)
            
            return result_chunks
        except Exception as e:
            print(f"嵌入分割失败: {str(e)}")
            # 失败时返回原始分割结果
            return chunks
    
    return split_by_embeddings

def process_pdf_document(document_id, split_method="recursive", chunk_size=1000, chunk_overlap=200, model_name="chatglm"):
    """
    从数据库获取PDF文件并进行处理
    
    Args:
        document_id: PDFDocument模型的ID
        split_method: 分割方法，可选值为 "recursive"(默认), "llm", 或 "embedding"
        chunk_size: 每个块的最大字符数
        chunk_overlap: 块之间的重叠字符数
        llm_model: 使用的语言模型名称，仅在 split_method="llm" 时有效
    
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

        for page in pages:
            page.page_content = clean_text(page.page_content)
        
        # 根据选择的方法进行分割
        if split_method == "llm":
            # 首先使用传统方法创建基本块
            basic_splitter = create_text_splitter(chunk_size, chunk_overlap)
            basic_docs = basic_splitter.split_documents(pages)
            
            # 然后使用LLM进行语义细分
            llm_splitter = create_llm_splitter(model_name)
            semantic_docs = []
            
            # 对每个基本块进行进一步的语义分割
            for doc in basic_docs:
                chunks = llm_splitter(doc.page_content)
                for chunk in chunks:
                    if chunk.strip():  # 确保不添加空块
                        new_doc = doc.model_copy()
                        new_doc.page_content = chunk
                        semantic_docs.append(new_doc)
            
            return semantic_docs
            
        elif split_method == "embedding":
            # 使用基于嵌入的语义分割
            embedding_splitter = create_embedding_splitter(chunk_size, chunk_overlap)
            return embedding_splitter(pages)
            
        else:
            # 默认使用标准递归字符分割
            text_splitter = create_text_splitter(chunk_size, chunk_overlap)
            return text_splitter.split_documents(pages)
        
    except PDFDocument.DoesNotExist:
        raise Exception(f"未找到ID为 {document_id} 的PDF文档")
    except Exception as e:
        raise Exception(f"处理PDF文档时发生错误: {str(e)}")

def get_pdf_text(document_id, split_method="recursive", chunk_size=1000, chunk_overlap=200, model_name="chatglm"):
    """
    获取PDF文档的完整文本内容
    
    Args:
        document_id: PDFDocument模型的ID
        split_method: 分割方法，可选值为 "recursive", "llm", 或 "embedding"
        chunk_size: 每个块的最大字符数
        chunk_overlap: 块之间的重叠字符数
        llm_model: 使用的语言模型名称，仅在 split_method="llm" 时有效
    
    Returns:
        str: PDF文档的完整文本内容
    """
    try:
        docs = process_pdf_document(document_id, split_method, chunk_size, chunk_overlap, model_name)
        return "\n\n".join([doc.page_content for doc in docs])
    except Exception as e:
        raise Exception(f"获取PDF文本时发生错误: {str(e)}")


