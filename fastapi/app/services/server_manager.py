# services/server_manager.py
import asyncio
import logging
from typing import Dict, List, Any
from .mcp_server import Server, Configuration
import os

class ServerManager:
    """Singleton manager for MCP servers to avoid repeated initialization."""
    
    _instance = None
    _initialized = False
    _servers: Dict[str, Server] = {}
    _lock = asyncio.Lock()
    _cached_tools = []
    
    # 采用单例模式，确保该类在整个应用中只有一个实例
    @classmethod
    async def get_instance(cls) -> 'ServerManager':
        """Get or create the singleton instance."""
        if cls._instance is None:
            cls._instance = ServerManager()
        
        if not cls._initialized:
            async with cls._lock:
                if not cls._initialized:
                    await cls._instance._initialize_servers()
        
        return cls._instance
    
    async def _initialize_servers(self) -> None:
        """Initialize all servers from configuration."""
        try:
            config = Configuration()
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
            config_path = os.path.join(base_dir, 'services', 'servers_config.json')
            servers_config = config.load_config(config_path)
            servers_config = self._expand_environment(servers_config)
            
            for name, srv_config in servers_config["mcpServers"].items():
                enabled = srv_config.pop("enabled", True)
                if isinstance(enabled, str):
                    enabled = enabled.lower() in {"1", "true", "yes", "on"}
                if not enabled:
                    logging.info(f"Server {name} is disabled")
                    continue
                server = Server(name, srv_config)
                try:
                    init_timeout = float(srv_config.get("init_timeout", 8))
                    await asyncio.wait_for(server.initialize(), timeout=init_timeout)
                    self._servers[name] = server
                    logging.info(f"Server {name} initialized successfully")
                except asyncio.TimeoutError:
                    await server.cleanup()
                    logging.error(f"Failed to initialize server {name}: timeout")
                except Exception as e:
                    logging.error(f"Failed to initialize server {name}: {e}")
            
            # Cache all available tools at startup
            self.__class__._cached_tools = await self.list_all_tools()
            logging.info(f"Cached {len(self.__class__._cached_tools)} tools from all servers")
            
            self.__class__._initialized = True
            logging.info("All servers initialized")
        except Exception as e:
            logging.error(f"Error initializing servers: {e}")
            raise

    @classmethod
    def _expand_environment(cls, value):
        if isinstance(value, dict):
            return {key: cls._expand_environment(item) for key, item in value.items()}
        if isinstance(value, list):
            return [cls._expand_environment(item) for item in value]
        if isinstance(value, str):
            return os.path.expandvars(value)
        return value
    
    def get_server(self, name: str) -> Server:
        """Get a server by name."""
        if name not in self._servers:
            raise ValueError(f"Server {name} not found")
        return self._servers[name]
    
    def get_all_servers(self) -> List[Server]:
        """Get all initialized servers."""
        return list(self._servers.values())
    
    async def list_all_tools(self) -> List[Any]:
        """List tools from all servers."""
        all_tools = []
        for server in self._servers.values():
            try:
                tools = await asyncio.wait_for(server.list_tools(), timeout=5)
                for tool in tools:
                    setattr(tool, "server_name", server.name)
                all_tools.extend(tools)
            except asyncio.TimeoutError:
                logging.error(f"Error listing tools from server {server.name}: timeout")
            except Exception as e:
                logging.error(f"Error listing tools from server {server.name}: {e}")
        
        return all_tools
    
    @classmethod
    def get_cached_tools(cls) -> List[Any]:
        """Get the cached tools that were saved at startup."""
        if not cls._initialized:
            logging.warning("Server manager not initialized yet, returning empty tool list")
            return []
        return cls._cached_tools
    
    async def execute_tool(self, server_name: str, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Execute a tool on a specific server."""
        server = self.get_server(server_name)
        return await server.execute_tool(tool_name, arguments)
    
    async def cleanup(self) -> None:
        """Clean up all servers."""
        for server in self._servers.values():
            try:
                await server.cleanup()
            except Exception as e:
                logging.error(f"Error cleaning up server {server.name}: {e}")
        
        self._servers.clear()
        self.__class__._initialized = False
