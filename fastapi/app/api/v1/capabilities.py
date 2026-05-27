from typing import Any, Dict, List

from fastapi import APIRouter

from app.services.server_manager import ServerManager
from app.skills import SkillRegistry


router = APIRouter()


def _serialize_schema(schema: Any) -> Dict[str, Any]:
    if isinstance(schema, dict):
        return schema
    return {}


def _serialize_skill(skill: Any) -> Dict[str, Any]:
    activation = SkillRegistry.activate_skill(skill.name)
    return {
        "name": skill.name,
        "description": skill.description,
        "source": "local-skill",
        "location": skill.location,
        "directory": skill.directory,
        "has_handler": skill.handler is not None,
        "resources": activation.get("resources", []),
        "metadata": skill.metadata,
    }


def _serialize_tool(tool: Any, server_name: str) -> Dict[str, Any]:
    return {
        "name": getattr(tool, "name", ""),
        "description": getattr(tool, "description", ""),
        "source": "mcp-tool",
        "server": server_name,
        "input_schema": _serialize_schema(getattr(tool, "input_schema", {})),
    }


@router.get("/")
async def list_capabilities() -> Dict[str, Any]:
    """Return currently connected MCP tools and locally registered skills."""

    skill_items = [_serialize_skill(skill) for skill in SkillRegistry.list_tools()]
    tool_items: List[Dict[str, Any]] = []
    errors: List[str] = []

    try:
        if not ServerManager._initialized:
            await ServerManager.get_instance()
    except Exception as exc:
        errors.append(f"MCP 服务初始化失败：{exc}")

    if ServerManager._initialized:
        cached_tools = ServerManager.get_cached_tools()
        tool_items = [
            _serialize_tool(tool, getattr(tool, "server_name", "已连接服务"))
            for tool in cached_tools
        ]
    else:
        errors.append("MCP 服务尚未初始化，暂时无法展示已接入 Tool。")

    return {
        "tools": tool_items,
        "skills": skill_items,
        "summary": {
            "tool_count": len(tool_items),
            "skill_count": len(skill_items),
            "error_count": len(errors),
        },
        "errors": errors,
    }
