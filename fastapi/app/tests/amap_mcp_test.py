import os
import json
import asyncio
import logging
import traceback
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
        if "mcpServers" not in servers_config or "zhipu-web-search-sse" not in servers_config["mcpServers"]:
            logging.error("Server configuration not found for 'zhipu-web-search-sse'")
            return
        
        server_config = servers_config["mcpServers"]["zhipu-web-search-sse"]
        
        # Initialize the server
        logging.info("Initializing server 'zhipu-web-search-sse'...")
        server = Server(name="zhipu-web-search-sse", config=server_config)
        await server.initialize()
        logging.info("Server initialized successfully!")
        
        # Get available tools
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