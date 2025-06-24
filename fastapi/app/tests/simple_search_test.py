#!/usr/bin/env python3
"""
简单的网络搜索测试程序

这个程序用于快速测试智谱网络搜索MCP服务器的功能。
它会执行一个基本的搜索查询并显示结果。

使用方法:
1. 确保servers_config.json中配置了zhipu-web-search-sse服务器
2. 运行: /opt/anaconda3/envs/django/bin/python simple_search_test.py
"""

import os
import json
import asyncio
import logging
import traceback
from typing import Any, Dict

# Import the Server and Configuration classes from mcp_server
from services.mcp_server import Server, Configuration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

async def test_search(query: str = "Python编程语言最新发展", count: int = 3):
    """
    测试网络搜索功能
    
    Args:
        query: 搜索查询字符串
        count: 返回结果数量
    """
    try:
        # Load configuration
        config = Configuration()
        config_path = os.path.join(os.path.dirname(__file__), "servers_config.json")
        servers_config = config.load_config(config_path)
        
        # Get the web search server configuration
        if "mcpServers" not in servers_config or "zhipu-web-search-sse" not in servers_config["mcpServers"]:
            logging.error("❌ 服务器配置未找到: 'zhipu-web-search-sse'")
            return False
        
        server_config = servers_config["mcpServers"]["zhipu-web-search-sse"]
        
        # Initialize the server
        logging.info("🚀 正在初始化搜索服务器...")
        server = Server(name="zhipu-web-search-sse", config=server_config)
        await server.initialize()
        logging.info("✅ 服务器初始化成功!")
        
        # List available tools
        tools = await server.list_tools()
        logging.info(f"📋 发现 {len(tools)} 个可用工具")
        
        # Execute search
        search_args = {
            "search_query": query,
            "search_engine": "search_std",
            "count": count
        }
        
        logging.info(f"🔍 正在搜索: '{query}'")
        result = await server.execute_tool("web_search", search_args)
        
        if result:
            logging.info("✅ 搜索成功!")
            
            # 使用logger输出结构化的搜索结果信息
            logging.info("\n" + "="*50)
            logging.info(f"搜索查询: {query}")
            logging.info(f"结果数量: {count}")
            logging.info("="*50)
            logging.info(result)
            
        else:
            logging.error("❌ 搜索失败 - 未返回结果")
            return False
        
    except Exception as e:
        logging.error(f"❌ 测试过程中发生错误: {e}")
        traceback.print_exc()
        return False

async def main():
    """
    主函数 - 运行搜索测试
    """
    print("🔍 智谱网络搜索测试程序")
    print("=" * 30)
    
    # 可以修改这里的搜索查询和结果数量
    success = await test_search(
        query="人工智能在2025年的最新发展趋势",
        count=3
    )
    
    if success:
        print("\n🎉 测试完成! 搜索功能正常工作")
    else:
        print("\n💥 测试失败! 请检查配置和网络连接")

if __name__ == "__main__":
    # Run the main function
    asyncio.run(main())