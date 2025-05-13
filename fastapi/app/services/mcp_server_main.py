#!/usr/bin/env python3
import os
import json
import asyncio
import logging
from contextlib import AsyncExitStack
import shutil
from typing import Any, Dict, List, Optional

# Import the Server and Configuration classes from mcp_server
from mcp_server import Server, Configuration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class PuppeteerToolTester:
    """Class to test all Puppeteer tools."""
    
    def __init__(self, server: Server):
        self.server = server
        self.test_url = "https://karpathy.ai/"
        self.results = []
    
    async def test_all_tools(self):
        """Run tests for all Puppeteer tools."""
        logging.info("\n=== Starting Puppeteer Tool Tests ===\n")
        
        # First navigate to a page
        await self.test_navigate()
        
        # Then run other tests that depend on having a page loaded
        await self.test_screenshot()
        await self.test_click()
        await self.test_fill()
        await self.test_select()
        await self.test_hover()
        await self.test_evaluate()
        
        # Print test results summary
        self._print_results_summary()
    
    async def test_navigate(self):
        """Test puppeteer_navigate tool."""
        tool_name = "puppeteer_navigate"
        arguments = {
            "url": self.test_url,
            "launchOptions": {"headless": True},
            "allowDangerous": False
        }
        
        logging.info(f"Testing {tool_name} with URL: {self.test_url}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": tool_name, "success": result is not None, "result": result})
        return result
    
    async def test_screenshot(self):
        """Test puppeteer_screenshot tool."""
        tool_name = "puppeteer_screenshot"
        arguments = {
            "name": "test_screenshot",
            "width": 800,
            "height": 600
        }
        
        logging.info(f"Testing {tool_name}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": tool_name, "success": result is not None, "result": result})
        return result
    
    async def test_click(self):
        """Test puppeteer_click tool."""
        tool_name = "puppeteer_click"
        arguments = {
            "selector": "a"  # Click the first link on the page
        }
        
        logging.info(f"Testing {tool_name} with selector: {arguments['selector']}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": tool_name, "success": result is not None, "result": result})
        return result
    
    async def test_fill(self):
        """Test puppeteer_fill tool."""
        tool_name = "puppeteer_fill"
        arguments = {
            "selector": "input[type=text]",  # Target a text input if it exists
            "value": "test input value"
        }
        
        logging.info(f"Testing {tool_name} with selector: {arguments['selector']}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": tool_name, "success": result is not None, "result": result})
        return result
    
    async def test_select(self):
        """Test puppeteer_select tool."""
        tool_name = "puppeteer_select"
        arguments = {
            "selector": "select",  # Target a select element if it exists
            "value": "option1"
        }
        
        logging.info(f"Testing {tool_name} with selector: {arguments['selector']}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": tool_name, "success": result is not None, "result": result})
        return result
    
    async def test_hover(self):
        """Test puppeteer_hover tool."""
        tool_name = "puppeteer_hover"
        arguments = {
            "selector": "a"  # Hover over the first link
        }
        
        logging.info(f"Testing {tool_name} with selector: {arguments['selector']}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": tool_name, "success": result is not None, "result": result})
        return result
    
    async def test_evaluate(self):
        """Test puppeteer_evaluate tool."""
        tool_name = "puppeteer_evaluate"
        arguments = {
            "script": "return document.title;"  # Get the page title
        }
        
        logging.info(f"Testing {tool_name} with script: {arguments['script']}")
        result = await self._execute_tool(tool_name, arguments)
        self.results.append({"tool": tool_name, "success": result is not None, "result": result})
        return result
    
    async def _execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Optional[Any]:
        """Execute a tool and handle exceptions."""
        try:
            result = await self.server.execute_tool(tool_name, arguments)
            logging.info(f"✅ {tool_name} executed successfully")
            logging.info(f"Result: {result}")
            return result
        except Exception as e:
            logging.error(f"❌ Error executing {tool_name}: {e}")
            return None
    
    def _print_results_summary(self):
        """Print a summary of all test results."""
        logging.info("\n=== Puppeteer Tool Test Results Summary ===\n")
        
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
    Test function to initialize an MCP server and test all Puppeteer tools.
    """
    try:
        # Load configuration
        config = Configuration()
        config_path = os.path.join(os.path.dirname(__file__), "servers_config.json")
        servers_config = config.load_config(config_path)
        
        # Get the puppeteer server configuration
        if "mcpServers" not in servers_config or "puppeteer" not in servers_config["mcpServers"]:
            logging.error("Server configuration not found for 'puppeteer'")
            return
        
        server_config = servers_config["mcpServers"]["puppeteer"]
        
        # Initialize the server
        logging.info("Initializing server 'puppeteer'...")
        server = Server(name="puppeteer", config=server_config)
        await server.initialize()
        logging.info("Server initialized successfully!")
        
        # List available tools
        logging.info("Listing available tools...")
        tools = await server.list_tools()
        
        # Print tool information
        logging.info(f"Found {len(tools)} tools:")
        for i, tool in enumerate(tools, 1):
            print(f"\n--- Tool {i}: {tool.name} ---")
            # print(f"Description: {tool.description}")
            # print("Parameters:")
            # if "properties" in tool.input_schema:
            #     for param_name, param_info in tool.input_schema["properties"].items():
            #         print(f"  - {param_name}: {param_info.get('description', 'No description')}")
            # else:
            #     print("  No parameters")
            print("format for llm: ")
            print(tool.format_for_llm())
        
        # Run comprehensive tests for all Puppeteer tools
        tester = PuppeteerToolTester(server)
        await tester.test_all_tools()
        
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
