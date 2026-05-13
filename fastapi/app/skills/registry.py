import inspect
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Union

try:
    import yaml
except ModuleNotFoundError:
    yaml = None

from .schedule import query_course_schedule


logger = logging.getLogger(__name__)

SkillHandler = Callable[[Dict[str, Any]], Union[Awaitable[Dict[str, Any]], Dict[str, Any]]]


@dataclass
class SkillRecord:
    """Metadata discovered from an Agent Skills SKILL.md file."""

    name: str
    description: str
    location: str
    body: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    handler: Optional[SkillHandler] = None

    @property
    def directory(self) -> str:
        return str(Path(self.location).parent)

    def format_for_llm(self) -> str:
        return f"""
Tool: {self.name}
Description: {self.description}
Location: {self.location}
Arguments:
- query: 用户原始查询或任务描述。可选。
- params: 从用户请求中提取的结构化参数。可选，详细参数在激活后的 SKILL.md 中说明。
"""


class SkillRegistry:
    """Agent Skills registry based on SKILL.md discovery and activation."""

    _skills: Dict[str, SkillRecord] = {}
    _diagnostics: List[str] = []
    _aliases: Dict[str, str] = {
        "course_schedule": "course-schedule",
        "course_scheduler": "course-schedule",
        "schedule_query": "course-schedule",
        "课表查询": "course-schedule",
    }
    _handlers: Dict[str, SkillHandler] = {
        "course-schedule": query_course_schedule,
    }
    _initialized = False

    @classmethod
    def _ensure_initialized(cls) -> None:
        if cls._initialized:
            return

        cls._skills = {}
        cls._diagnostics = []
        for skills_dir in cls._skill_search_paths():
            cls._discover_from_directory(skills_dir)
        cls._initialized = True

    @classmethod
    def _skill_search_paths(cls) -> List[Path]:
        app_skills_dir = Path(__file__).resolve().parent
        repo_root = app_skills_dir.parents[2]
        home_dir = Path.home()

        raw_paths = [
            app_skills_dir,
            home_dir / ".agents" / "skills",
            home_dir / ".zafugpt" / "skills",
            repo_root / ".agents" / "skills",
            repo_root / ".zafugpt" / "skills",
        ]

        paths: List[Path] = []
        for path in raw_paths:
            if path.exists() and path.is_dir() and path not in paths:
                paths.append(path)
        return paths

    @classmethod
    def _discover_from_directory(cls, skills_dir: Path) -> None:
        for child in sorted(skills_dir.iterdir()):
            if not child.is_dir() or child.name in {"__pycache__", ".git", "node_modules"}:
                continue

            skill_file = child / "SKILL.md"
            if not skill_file.exists():
                continue

            skill = cls._parse_skill_file(skill_file)
            if skill is None:
                continue

            existing = cls._skills.get(skill.name)
            if existing:
                cls._diagnostics.append(
                    f"skill name collision: {skill.name} at {skill.location} overrides {existing.location}"
                )

            skill.handler = cls._handlers.get(skill.name)
            cls._skills[skill.name] = skill

    @classmethod
    def _parse_skill_file(cls, skill_file: Path) -> Optional[SkillRecord]:
        try:
            content = skill_file.read_text(encoding="utf-8")
        except OSError as exc:
            cls._diagnostics.append(f"failed to read {skill_file}: {exc}")
            return None

        if not content.startswith("---"):
            cls._diagnostics.append(f"missing frontmatter in {skill_file}")
            return None

        parts = content.split("---", 2)
        if len(parts) < 3:
            cls._diagnostics.append(f"malformed frontmatter in {skill_file}")
            return None

        frontmatter_text = parts[1].strip()
        body = parts[2].strip()

        frontmatter = cls._parse_frontmatter(frontmatter_text, skill_file)
        if frontmatter is None:
            return None

        name = str(frontmatter.get("name", "")).strip()
        description = str(frontmatter.get("description", "")).strip()

        if not name:
            cls._diagnostics.append(f"missing name in {skill_file}")
            return None
        if not description:
            cls._diagnostics.append(f"missing description in {skill_file}")
            return None
        if name != skill_file.parent.name:
            cls._diagnostics.append(
                f"skill name {name} does not match directory {skill_file.parent.name}"
            )

        return SkillRecord(
            name=name,
            description=description,
            location=str(skill_file.resolve()),
            body=body,
            metadata={
                key: value
                for key, value in frontmatter.items()
                if key not in {"name", "description"}
            },
        )

    @classmethod
    def _parse_frontmatter(cls, frontmatter_text: str, skill_file: Path) -> Optional[Dict[str, Any]]:
        if yaml is not None:
            try:
                parsed = yaml.safe_load(frontmatter_text) or {}
            except yaml.YAMLError as exc:
                cls._diagnostics.append(f"unparseable YAML in {skill_file}: {exc}")
                return None
            if not isinstance(parsed, dict):
                cls._diagnostics.append(f"frontmatter is not a mapping in {skill_file}")
                return None
            return parsed

        parsed: Dict[str, Any] = {}
        for line in frontmatter_text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if ":" not in stripped:
                cls._diagnostics.append(f"ignored malformed frontmatter line in {skill_file}: {stripped}")
                continue
            key, value = stripped.split(":", 1)
            parsed[key.strip()] = value.strip().strip("\"'")
        return parsed

    @classmethod
    def list_tools(cls) -> List[SkillRecord]:
        cls._ensure_initialized()
        return list(cls._skills.values())

    @classmethod
    def get_tool(cls, name: str) -> Optional[SkillRecord]:
        cls._ensure_initialized()
        canonical_name = cls._aliases.get(name, name)
        return cls._skills.get(canonical_name)

    @classmethod
    def has_tool(cls, name: str) -> bool:
        return cls.get_tool(name) is not None

    @classmethod
    def activate_skill(cls, name: str) -> Dict[str, Any]:
        skill = cls.get_tool(name)
        if skill is None:
            return {"error": f"未知 skill: {name}", "tool": name}

        resources = cls._list_bundled_resources(Path(skill.directory))
        return {
            "name": skill.name,
            "description": skill.description,
            "location": skill.location,
            "directory": skill.directory,
            "content": (
                f'<skill_content name="{skill.name}">\n'
                f"{skill.body}\n\n"
                f"Skill directory: {skill.directory}\n"
                "Relative paths in this skill are relative to the skill directory.\n"
                f"{cls._format_resources(resources)}\n"
                "</skill_content>"
            ),
            "resources": resources,
        }

    @classmethod
    def _list_bundled_resources(cls, skill_dir: Path, limit: int = 200) -> List[str]:
        resources: List[str] = []
        for subdir_name in ("scripts", "references", "assets"):
            subdir = skill_dir / subdir_name
            if not subdir.exists() or not subdir.is_dir():
                continue
            for root, dirs, files in os.walk(subdir):
                dirs[:] = [directory for directory in dirs if directory not in {"__pycache__", ".git"}]
                for filename in sorted(files):
                    relative_path = Path(root, filename).relative_to(skill_dir)
                    resources.append(str(relative_path))
                    if len(resources) >= limit:
                        return resources
        return resources

    @classmethod
    def _format_resources(cls, resources: List[str]) -> str:
        if not resources:
            return "<skill_resources />"
        resource_lines = "\n".join(f"  <file>{resource}</file>" for resource in resources)
        return f"<skill_resources>\n{resource_lines}\n</skill_resources>"

    @classmethod
    async def execute_tool(cls, name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        skill = cls.get_tool(name)
        if skill is None:
            return {"error": f"未知 skill: {name}", "tool": name}

        params = params or {}
        if isinstance(params.get("params"), dict):
            params = {**params, **params["params"]}
            params.pop("params", None)

        activation = cls.activate_skill(skill.name)
        if skill.handler is None:
            return {
                "status": "success",
                "skill": skill.name,
                "activation": activation,
                "message": "skill 已激活，但没有绑定本地执行函数",
                "params": params,
            }

        result = skill.handler(params)
        if inspect.isawaitable(result):
            result = await result

        if isinstance(result, dict):
            result["skill"] = skill.name
            result["activation"] = activation
        return result

    @classmethod
    def diagnostics(cls) -> List[str]:
        cls._ensure_initialized()
        return list(cls._diagnostics)
