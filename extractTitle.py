from docx import Document

def extract_headings(docx_path):
    """
    从Word文档中提取所有标题
    :param docx_path: Word文档的路径
    :return: 包含所有标题的列表
    """
    doc = Document(docx_path)
    headings = []
    
    for paragraph in doc.paragraphs:
        # 检查段落的样式名称是否包含'Heading'
        if paragraph.style.name.startswith('Heading'):
            headings.append({
                'level': int(paragraph.style.name[-1]),  # 获取标题级别
                'text': paragraph.text
            })
    
    return headings

def print_headings(headings):
    """
    以结构化格式打印标题
    :param headings: 标题列表
    """
    print("<document_structure>")
    current_level = 0
    
    for heading in headings:
        level = heading['level']
        text = heading['text']
        
        # 处理缩进
        if level > current_level:
            print("  " * (level-1) + f"<section level={level}>")
        elif level < current_level:
            # 关闭之前的部分
            for i in range(current_level, level-1, -1):
                print("  " * (i-1) + "</section>")
        
        # 打印标题
        print("  " * level + f"<heading>{text}</heading>")
        current_level = level
    
    # 关闭所有剩余的部分
    for i in range(current_level, 0, -1):
        print("  " * (i-1) + "</section>")
    print("</document_structure>")

if __name__ == "__main__":
    # 替换为你的Word文档路径
    docx_file = "/Users/charn/Desktop/投标人资格审查/test.docx"
    
    try:
        headings = extract_headings(docx_file)
        if headings:
            print("# 文档结构提取结果")
            print_headings(headings)
        else:
            print("未找到任何标题")
    except Exception as e:
        print(f"处理文档时出错：{str(e)}")
