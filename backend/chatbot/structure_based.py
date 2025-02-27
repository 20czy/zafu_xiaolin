def create_structure_based_splitter(min_heading_length=4, max_heading_length=100, heading_patterns=None):
    """
    创建基于文档结构的分割器
    
    Args:
        min_heading_length: 标题的最小长度，用于过滤掉太短的文本行
        max_heading_length: 标题的最大长度，用于过滤掉太长的文本行
        heading_patterns: 额外的标题模式正则表达式列表
    
    Returns:
        一个函数，可以根据文档结构分割PDF文档
    """
    import re
    from langchain_core.documents import Document
    
    # 默认的标题模式
    default_patterns = [
        # 数字格式标题: "1. 标题", "1.1 标题", "第一章 标题"
        r"^\s*(?:\d+\.)+\s+.{" + str(min_heading_length) + "," + str(max_heading_length) + "}$",
        r"^\s*\d+\.\s+.{" + str(min_heading_length) + "," + str(max_heading_length) + "}$",
        r"^\s*第[一二三四五六七八九十百千万亿\d]+[章节篇部分]\s+.{" + str(min_heading_length) + "," + str(max_heading_length) + "}$",
        
        # 字母格式标题: "A. 标题", "a) 标题"
        r"^\s*[A-Z]\.\s+.{" + str(min_heading_length) + "," + str(max_heading_length) + "}$",
        r"^\s*[a-z]\)\s+.{" + str(min_heading_length) + "," + str(max_heading_length) + "}$",
        
        # 特殊格式标题: 全大写，居中或特殊字符开头的
        r"^\s*[【\[\(（].{" + str(min_heading_length) + "," + str(max_heading_length) + "}[】\]\)）]$",
        r"^[A-Z\s]{" + str(min_heading_length) + "," + str(max_heading_length) + "}$",
        
        # 一般的段落标题: 短行，后面紧跟段落内容
        r"^\s*.{" + str(min_heading_length) + "," + str(max_heading_length) + "}[:：]$"
    ]
    
    # 合并默认模式和自定义模式
    patterns = default_patterns
    if heading_patterns:
        patterns.extend(heading_patterns)
    
    # 编译正则表达式以提高性能
    compiled_patterns = [re.compile(pattern) for pattern in patterns]
    
    def is_likely_heading(line):
        """
        判断一行文本是否可能是标题
        """
        # 标题通常不会太长也不会太短
        if len(line.strip()) < min_heading_length or len(line.strip()) > max_heading_length:
            return False
            
        # 使用正则表达式匹配可能的标题格式
        for pattern in compiled_patterns:
            if pattern.match(line.strip()):
                return True
                
        # 检查格式特征，如全大写，缩进
        uppercase_ratio = sum(1 for c in line if c.isupper()) / len(line.strip()) if line.strip() else 0
        if uppercase_ratio > 0.7 and len(line.strip()) >= min_heading_length:
            return True
            
        # 字体和格式特征提取（如果PDF元数据中有字体信息）
        # 这部分在当前实现中无法直接获取，需要额外的PDF解析库支持
        
        return False
    
    def analyze_document_structure(pages):
        """
        分析文档结构，识别可能的章节和标题
        
        Args:
            pages: 通过PyPDFLoader加载的页面列表
            
        Returns:
            list: 包含结构信息的文档块列表
        """
        # 提取每个页面的文本行和元数据
        structured_pages = []
        
        for page in pages:
            content = page.page_content
            metadata = page.metadata.copy()
            
            # 按行分割文本
            lines = content.split('\n')
            
            # 当前页面的结构化行
            structured_lines = []
            
            for line in lines:
                line_type = 'heading' if is_likely_heading(line) else 'content'
                structured_lines.append({
                    'text': line,
                    'type': line_type
                })
                
            structured_pages.append({
                'lines': structured_lines,
                'metadata': metadata
            })
            
        return structured_pages
    
    def reconstruct_sections(structured_pages):
        """
        根据结构信息重建文档章节
        
        Args:
            structured_pages: 包含结构信息的页面列表
            
        Returns:
            list: 重组后的文档块
        """
        sections = []
        current_heading = None
        current_content = []
        current_metadata = None
        
        # 遍历所有页面和行
        for page in structured_pages:
            for line in page['lines']:
                if line['type'] == 'heading':
                    # 如果已有内容，保存前一个章节
                    if current_content and (current_heading or len(''.join(current_content).strip()) > min_heading_length * 4):
                        section_text = (current_heading + '\n' if current_heading else '') + '\n'.join(current_content)
                        
                        # 创建文档对象
                        doc = Document(
                            page_content=section_text.strip(),
                            metadata=current_metadata or page['metadata'].copy()
                        )
                        
                        # 添加标题信息到元数据
                        if current_heading:
                            doc.metadata['heading'] = current_heading
                            
                        sections.append(doc)
                        
                    # 开始新的章节
                    current_heading = line['text']
                    current_content = []
                    current_metadata = page['metadata'].copy()
                else:
                    # 添加内容到当前章节
                    current_content.append(line['text'])
                    
                    # 确保我们有元数据
                    if not current_metadata:
                        current_metadata = page['metadata'].copy()
        
        # 添加最后一个章节
        if current_content:
            section_text = (current_heading + '\n' if current_heading else '') + '\n'.join(current_content)
            
            doc = Document(
                page_content=section_text.strip(),
                metadata=current_metadata or structured_pages[-1]['metadata'].copy()
            )
            
            if current_heading:
                doc.metadata['heading'] = current_heading
                
            sections.append(doc)
            
        return sections
        
    def detect_font_features(pages):
        """
        尝试从PDF元数据中检测字体特征
        这需要更高级的PDF解析库，此处为占位实现
        
        Args:
            pages: PDF页面列表
            
        Returns:
            dict: 可能的字体信息
        """
        try:
            # 如果将来要实现，可以使用pdfplumber或PyMuPDF等库
            # 当前只返回空字典
            return {}
        except:
            return {}
            
    def split_documents(docs):
        """
        根据文档结构分割文档
        
        Args:
            docs: 要分割的文档列表
            
        Returns:
            list: 按结构分割后的文档列表
        """
        try:
            # 分析文档结构
            structured_pages = analyze_document_structure(docs)
            
            # 根据结构重组文档
            structured_docs = reconstruct_sections(structured_pages)
            
            return structured_docs
        except Exception as e:
            print(f"结构分割失败: {str(e)}")
            # 失败时返回原始文档
            return docs
            
    return split_documents

def process_pdf_document(document_id, split_method="recursive", chunk_size=1000, chunk_overlap=200, model_name="chatglm"):
    """
    从数据库获取PDF文件并进行处理
    
    Args:
        document_id: PDFDocument模型的ID
        split_method: 分割方法，可选值为 "recursive"(默认), "llm", "embedding" 或 "structure"
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
            
        elif split_method == "structure":
            # 使用基于文档结构的分割
            structure_splitter = create_structure_based_splitter()
            structure_docs = structure_splitter(pages)
            
            # 如果结构化分割产生的块太大，进行进一步的分割
            if any(len(doc.page_content) > chunk_size * 2 for doc in structure_docs):
                text_splitter = create_text_splitter(chunk_size, chunk_overlap)
                return text_splitter.split_documents(structure_docs)
            
            return structure_docs
            
        else:
            # 默认使用标准递归字符分割
            text_splitter = create_text_splitter(chunk_size, chunk_overlap)
            return text_splitter.split_documents(pages)
        
    except PDFDocument.DoesNotExist:
        raise Exception(f"未找到ID为 {document_id} 的PDF文档")
    except Exception as e:
        raise Exception(f"处理PDF文档时发生错误: {str(e)}")

# 更新其他函数以支持结构化分割
def get_pdf_text(document_id, split_method="recursive", chunk_size=1000, chunk_overlap=200, model_name="chatglm"):
    """
    获取PDF文档的完整文本内容
    
    Args:
        document_id: PDFDocument模型的ID
        split_method: 分割方法，可选值为 "recursive", "llm", "embedding" 或 "structure"
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