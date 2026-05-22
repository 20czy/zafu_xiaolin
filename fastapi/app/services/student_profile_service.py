from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional


STUDENT_PROFILE_PATH = Path(__file__).resolve().parents[1] / "data" / "student_profile.md"


@lru_cache(maxsize=1)
def load_student_profile_document() -> str:
    try:
        return STUDENT_PROFILE_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        return ""


def parse_student_profile(document: Optional[str] = None) -> Dict[str, str]:
    content = document if document is not None else load_student_profile_document()
    profile: Dict[str, str] = {}

    for line in content.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") or "---" in stripped or "字段" in stripped:
            continue

        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if len(cells) < 2:
            continue

        key, value = cells[0], cells[1]
        if key and value:
            profile[key] = value

    return profile


def format_student_profile_for_prompt() -> str:
    document = load_student_profile_document()
    profile = parse_student_profile(document)

    if not profile:
        return "当前没有可用的学生画像信息。"

    profile_lines = "\n".join(f"- {key}: {value}" for key, value in profile.items())
    return f"""当前用户学生画像：
{profile_lines}

使用要求：
1. 画像信息只作为当前用户上下文，不要主动完整复述。
2. 当用户的问题与课表、通知、校区、宿舍、学院、专业、年级、导师或联系方式相关时，可以基于画像给出更贴合的建议。
3. 除非用户明确询问个人信息，否则不要输出手机号、宿舍等敏感字段。"""
