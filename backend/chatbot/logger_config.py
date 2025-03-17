import logging

def setup_logger(name):
    """
    配置并返回logger实例
    
    Args:
        name: logger的名称
        
    Returns:
        配置好的logger实例
    """
    # 创建 logger
    logger = logging.getLogger(name)
    # 设置 logger 的日志级别
    logger.setLevel(logging.DEBUG)

    # 创建控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)

    # 创建文件处理器
    file_handler = logging.FileHandler('app.log')
    file_handler.setLevel(logging.DEBUG)

    # 创建日志格式
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # 将日志格式应用到处理器
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)

    # 将处理器添加到 logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger