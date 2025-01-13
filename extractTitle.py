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
    打印标题，并根据级别进行缩进
    :param headings: 标题列表
    """
    for heading in headings:
        indent = "  " * (heading['level'] - 1)  # 根据标题级别添加缩进
        print(f"{indent}{'#' * heading['level']} {heading['text']}")

if __name__ == "__main__":
    # 替换为你的Word文档路径
    docx_file = "/Users/charn/Desktop/投标人资格审查/test.docx"
    
    try:
        headings = extract_headings(docx_file)
        if headings:
            print("文档中的标题结构：")
            print_headings(headings)
        else:
            print("未找到任何标题")
    except Exception as e:
        print(f"处理文档时出错：{str(e)}")
