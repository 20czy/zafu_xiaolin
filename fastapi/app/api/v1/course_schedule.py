from typing import Optional

from fastapi import APIRouter, Query

from app.services.course_schedule_service import query_mock_course_schedule


router = APIRouter()


@router.get("/")
async def get_course_schedule(
    major: Optional[str] = Query(None, description="专业名称，例如：计算机科学"),
    grade: Optional[str] = Query(None, description="年级，例如：2023、2023级"),
    class_name: Optional[str] = Query(None, description="班级，例如：计科2301班"),
    semester: Optional[str] = Query(None, description="学期，例如：2023-2024-2"),
    day_of_week: Optional[str] = Query(None, description="星期，例如：周一、1、今天、明天"),
    course_id: Optional[str] = Query(None, description="课程编号，例如：CS101"),
    course_name: Optional[str] = Query(None, description="课程名称关键词，例如：数据结构"),
    teacher: Optional[str] = Query(None, description="教师姓名关键词"),
    instructor: Optional[str] = Query(None, description="教师姓名关键词，兼容字段"),
    campus: Optional[str] = Query(None, description="校区，例如：东湖校区"),
):
    """返回 mock 课表数据，支持按常见课表字段筛选。"""

    return query_mock_course_schedule(
        {
            "major": major,
            "grade": grade,
            "class_name": class_name,
            "semester": semester,
            "day_of_week": day_of_week,
            "course_id": course_id,
            "course_name": course_name,
            "teacher": teacher,
            "instructor": instructor,
            "campus": campus,
        }
    )
