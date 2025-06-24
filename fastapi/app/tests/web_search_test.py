#!/usr/bin/env python3
import os
import json
import asyncio
import logging
import traceback
from typing import Any, Dict, List, Optional

# Import the Server and Configuration classes from mcp_server
from services.mcp_server import Server, Configuration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class WebSearchToolTester:
    """Class to test web search tools."""
    
    def __init__(self, server: Server):
        self.server = server
        self.results = []
    
    async def test_all_search_tools(self):
        """Run tests for all web search tools."""
        logging.info("\n=== Starting Web Search Tool Tests ===\n")
        
        # Test basic search
        await self.test_basic_search()
        
        # Test search with different engines
        await self.test_search_engines()
        
        # Test search with filters
        await self.test_search_with_filters()
        
        # Test search with different content sizes
        await self.test_content_sizes()
        
        # Print test results summary
        self._print_results_summary()
    
    async def test_basic_search(self):
        """Test basic web search functionality."""
        tool_name = "web_search"
        arguments = {
            "search_query": "Python编程语言",
            "count": 5
        }
        
        logging.info(f"Testing {tool_name} with basic query: {arguments['search_query']}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": f"{tool_name}_basic", "success": result is not None, "result": result})
        return result
    
    async def test_search_engines(self):
        """Test different search engines."""
        tool_name = "web_search"
        engines = ["search_std", "search_pro", "search_pro_sogou", "search_pro_quark", "search_pro_jina"]
        
        for engine in engines:
            arguments = {
                "search_query": "人工智能最新发展",
                "search_engine": engine,
                "count": 3
            }
            
            logging.info(f"Testing {tool_name} with engine: {engine}")
            result = await self._execute_tool(tool_name, arguments)
            self.results.append({"tool": f"{tool_name}_{engine}", "success": result is not None, "result": result})
    
    async def test_search_with_filters(self):
        """Test search with domain and recency filters."""
        tool_name = "web_search"
        
        # Test with domain filter
        arguments = {
            "search_query": "机器学习教程",
            "search_engine": "search_std",
            "count": 5,
            "search_domain_filter": "github.com"
        }
        
        logging.info(f"Testing {tool_name} with domain filter: {arguments['search_domain_filter']}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": f"{tool_name}_domain_filter", "success": result is not None, "result": result})
        
        # Test with recency filter
        arguments = {
            "search_query": "2024年科技新闻",
            "search_engine": "search_std",
            "count": 5,
            "search_recency_filter": "oneMonth"
        }
        
        logging.info(f"Testing {tool_name} with recency filter: {arguments['search_recency_filter']}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": f"{tool_name}_recency_filter", "success": result is not None, "result": result})
    
    async def test_content_sizes(self):
        """Test different content sizes."""
        tool_name = "web_search"
        content_sizes = ["medium", "high"]
        
        for size in content_sizes:
            arguments = {
                "search_query": "深度学习框架比较",
                "search_engine": "search_std",
                "count": 3,
                "content_size": size
            }
            
            logging.info(f"Testing {tool_name} with content size: {size}")
            result = await self._execute_tool(tool_name, arguments)
            self.results.append({"tool": f"{tool_name}_content_{size}", "success": result is not None, "result": result})
    
    async def _execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Optional[Any]:
        """Execute a tool and handle exceptions."""
        try:
            result = await self.server.execute_tool(tool_name, arguments)
            logging.info(f"✅ {tool_name} executed successfully")
            logging.info(f"Result preview: {str(result)[:200]}..." if len(str(result)) > 200 else f"Result: {result}")
            return result
        except Exception as e:
            logging.error(f"❌ Error executing {tool_name}: {e}")
            return None
    
    def _print_results_summary(self):
        """Print a summary of all test results."""
        logging.info("\n=== Web Search Tool Test Results Summary ===\n")
        
        success_count = sum(1 for r in self.results if r["success"])
        total_count = len(self.results)
        
        logging.info(f"Total tests: {total_count}")
        logging.info(f"Successful: {success_count}")
        logging.info(f"Failed: {total_count - success_count}")
        
        logging.info("\nDetailed results:")
        for i, result in enumerate(self.results, 1):
            status = "✅ Success" if result["success"] else "❌ Failed"
            logging.info(f"{i}. {result['tool']}: {status}")

async def main():
    """
    Test function to initialize an MCP server and test web search tools.
    """
    try:
        # Load configuration
        config = Configuration()
        config_path = os.path.join(os.path.dirname(__file__), "servers_config.json")
        servers_config = config.load_config(config_path)
        
        # Get the web search server configuration
        if "mcpServers" not in servers_config or "zhipu-web-search-sse" not in servers_config["mcpServers"]:
            logging.error("Server configuration not found for 'zhipu-web-search-sse'")
            return
        
        server_config = servers_config["mcpServers"]["zhipu-web-search-sse"]
        
        # Initialize the server
        logging.info("Initializing server 'zhipu-web-search-sse'...")
        server = Server(name="zhipu-web-search-sse", config=server_config)
        await server.initialize()
        logging.info("Server initialized successfully!")
        
        # List available tools
        logging.info("Listing available tools...")
        tools = await server.list_tools()
        
        # Print tool information
        logging.info(f"Found {len(tools)} tools:")
        for i, tool in enumerate(tools, 1):
            print(f"\n--- Tool {i}: {tool.name} ---")
            print("format for llm: ")
            print(tool.format_for_llm())
        
        # Run comprehensive tests for web search tools
        tester = WebSearchToolTester(server)
        await tester.test_all_search_tools()
        
        # Clean up
        logging.info("\nCleaning up server resources...")
        await server.cleanup()
        logging.info("Server cleanup completed")
        
    except Exception as e:
        logging.error(f"Error in main function: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    # Run the main function
    asyncio.run(main())