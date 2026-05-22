from typing import Any, Dict

from fastapi import APIRouter

from app.services.student_profile_service import (
    STUDENT_PROFILE_PATH,
    load_student_profile_document,
    parse_student_profile,
)


router = APIRouter()


@router.get("/")
async def get_student_profile() -> Dict[str, Any]:
    """Return the mock student profile used as AI context."""

    document = load_student_profile_document()
    return {
        "status": "success" if document else "empty",
        "profile": parse_student_profile(document),
        "document": document,
        "source": str(STUDENT_PROFILE_PATH),
    }
