from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional


DAY_LABELS = {
    1: "周一",
    2: "周二",
    3: "周三",
    4: "周四",
    5: "周五",
    6: "周六",
    7: "周日",
}


MOCK_COURSE_SCHEDULE = [
    {
        "course_id": "CS101",
        "course_name": "计算机导论",
        "course_type": "必修",
        "credits": 3.0,
        "instructor": "张建国",
        "instructor_title": "教授",
        "major": "计算机科学与技术",
        "grade": 2023,
        "semester": "2025-2026-1",
        "teaching_week_start": 1,
        "teaching_week_end": 16,
        "week_type": "all",  # all / odd / even
        "day_of_week": 1,  # 1=Monday
        "section_start": 1,
        "section_end": 2,
        "start_time": "08:00",
        "end_time": "09:40",
        "campus": "主校区",
        "building": "信息楼A",
        "classroom": "A101",
        "capacity": 80,
        "selected_count": 76,
        "exam_type": "考试",
    },
    {
        "course_id": "CS201",
        "course_name": "数据结构与算法",
        "course_type": "必修",
        "credits": 4.0,
        "instructor": "李明",
        "instructor_title": "副教授",
        "major": "计算机科学与技术",
        "grade": 2023,
        "semester": "2025-2026-1",
        "teaching_week_start": 1,
        "teaching_week_end": 16,
        "week_type": "all",
        "day_of_week": 2,
        "section_start": 3,
        "section_end": 4,
        "start_time": "10:00",
        "end_time": "11:40",
        "campus": "主校区",
        "building": "信息楼A",
        "classroom": "A203",
        "capacity": 60,
        "selected_count": 58,
        "exam_type": "考试",
    },
    {
        "course_id": "CS301",
        "course_name": "操作系统",
        "course_type": "必修",
        "credits": 4.0,
        "instructor": "王磊",
        "instructor_title": "教授",
        "major": "软件工程",
        "grade": 2022,
        "semester": "2025-2026-1",
        "teaching_week_start": 1,
        "teaching_week_end": 16,
        "week_type": "all",
        "day_of_week": 3,
        "section_start": 5,
        "section_end": 6,
        "start_time": "14:00",
        "end_time": "15:40",
        "campus": "主校区",
        "building": "软件楼B",
        "classroom": "B305",
        "capacity": 50,
        "selected_count": 47,
        "exam_type": "考试",
    },
    {
        "course_id": "CS302",
        "course_name": "操作系统实验",
        "course_type": "实验",
        "credits": 1.5,
        "instructor": "王磊",
        "instructor_title": "教授",
        "major": "软件工程",
        "grade": 2022,
        "semester": "2025-2026-1",
        "teaching_week_start": 2,
        "teaching_week_end": 15,
        "week_type": "even",
        "day_of_week": 5,
        "section_start": 7,
        "section_end": 8,
        "start_time": "16:00",
        "end_time": "17:40",
        "campus": "主校区",
        "building": "实验中心",
        "classroom": "Lab-402",
        "capacity": 30,
        "selected_count": 28,
        "exam_type": "考查",
    },
    {
        "course_id": "EE101",
        "course_name": "电路分析基础",
        "course_type": "必修",
        "credits": 3.5,
        "instructor": "刘芳",
        "instructor_title": "副教授",
        "major": "电子信息工程",
        "grade": 2023,
        "semester": "2025-2026-1",
        "teaching_week_start": 1,
        "teaching_week_end": 16,
        "week_type": "all",
        "day_of_week": 1,
        "section_start": 3,
        "section_end": 4,
        "start_time": "10:00",
        "end_time": "11:40",
        "campus": "东校区",
        "building": "电子楼C",
        "classroom": "C201",
        "capacity": 100,
        "selected_count": 92,
        "exam_type": "考试",
    },
    {
        "course_id": "EE202",
        "course_name": "数字逻辑设计",
        "course_type": "必修",
        "credits": 3.0,
        "instructor": "陈涛",
        "instructor_title": "讲师",
        "major": "电子信息工程",
        "grade": 2022,
        "semester": "2025-2026-1",
        "teaching_week_start": 1,
        "teaching_week_end": 16,
        "week_type": "odd",
        "day_of_week": 4,
        "section_start": 1,
        "section_end": 2,
        "start_time": "08:00",
        "end_time": "09:40",
        "campus": "东校区",
        "building": "电子楼C",
        "classroom": "C305",
        "capacity": 45,
        "selected_count": 41,
        "exam_type": "考试",
    },
    {
        "course_id": "GE101",
        "course_name": "大学英语III",
        "course_type": "公共必修",
        "credits": 2.0,
        "instructor": "赵敏",
        "instructor_title": "讲师",
        "major": "全校公共课",
        "grade": 2023,
        "semester": "2025-2026-1",
        "teaching_week_start": 1,
        "teaching_week_end": 16,
        "week_type": "all",
        "day_of_week": 2,
        "section_start": 7,
        "section_end": 8,
        "start_time": "16:00",
        "end_time": "17:40",
        "campus": "主校区",
        "building": "外语楼D",
        "classroom": "D102",
        "capacity": 120,
        "selected_count": 115,
        "exam_type": "考试",
    },
    {
        "course_id": "PE101",
        "course_name": "大学体育（篮球）",
        "course_type": "公共必修",
        "credits": 1.0,
        "instructor": "孙强",
        "instructor_title": "讲师",
        "major": "全校公共课",
        "grade": 2023,
        "semester": "2025-2026-1",
        "teaching_week_start": 1,
        "teaching_week_end": 16,
        "week_type": "all",
        "day_of_week": 4,
        "section_start": 5,
        "section_end": 6,
        "start_time": "14:00",
        "end_time": "15:40",
        "campus": "体育馆",
        "building": "篮球馆",
        "classroom": "Court-1",
        "capacity": 40,
        "selected_count": 36,
        "exam_type": "考查",
    },
]


def normalize_day(day_value: Any) -> Optional[int]:
    if day_value in (None, ""):
        return None

    day_text = str(day_value).strip()
    digit_map = {
        "1": 1,
        "2": 2,
        "3": 3,
        "4": 4,
        "5": 5,
        "6": 6,
        "7": 7,
    }
    cn_map = {
        "周一": 1,
        "星期一": 1,
        "礼拜一": 1,
        "周二": 2,
        "星期二": 2,
        "礼拜二": 2,
        "周三": 3,
        "星期三": 3,
        "礼拜三": 3,
        "周四": 4,
        "星期四": 4,
        "礼拜四": 4,
        "周五": 5,
        "星期五": 5,
        "礼拜五": 5,
        "周六": 6,
        "星期六": 6,
        "礼拜六": 6,
        "周日": 7,
        "周天": 7,
        "星期日": 7,
        "星期天": 7,
        "礼拜日": 7,
        "礼拜天": 7,
    }

    if day_text in digit_map:
        return digit_map[day_text]
    if day_text in cn_map:
        return cn_map[day_text]
    if day_text == "今天":
        return datetime.now().isoweekday()
    if day_text == "明天":
        return (datetime.now() + timedelta(days=1)).isoweekday()
    return None


def _contains(value: Any, keyword: Any) -> bool:
    if keyword in (None, ""):
        return True
    return str(keyword).strip().lower() in str(value).strip().lower()


def _format_course(course: Dict[str, Any]) -> Dict[str, Any]:
    formatted = dict(course)
    formatted["day_label"] = DAY_LABELS.get(course["day_of_week"], str(course["day_of_week"]))
    formatted["time"] = f"{course['start_time']}-{course['end_time']}"
    return formatted


def query_mock_course_schedule(params: Dict[str, Any]) -> Dict[str, Any]:
    day_of_week = normalize_day(params.get("day_of_week") or params.get("day"))
    teacher = params.get("teacher") or params.get("instructor")

    courses: List[Dict[str, Any]] = []
    for course in MOCK_COURSE_SCHEDULE:
        if params.get("major") and not _contains(course["major"], params["major"]):
            continue
        if params.get("semester") and course["semester"] != str(params["semester"]).strip():
            continue
        if params.get("course_id") and course["course_id"].lower() != str(params["course_id"]).strip().lower():
            continue
        if params.get("course_name") and not _contains(course["course_name"], params["course_name"]):
            continue
        if teacher and not _contains(course["instructor"], teacher):
            continue
        if day_of_week is not None and course["day_of_week"] != day_of_week:
            continue
        courses.append(_format_course(course))

    return {
        "status": "success",
        "filters": {
            "major": params.get("major"),
            "semester": params.get("semester"),
            "day_of_week": day_of_week,
            "course_id": params.get("course_id"),
            "course_name": params.get("course_name"),
            "teacher": teacher,
        },
        "count": len(courses),
        "courses": courses,
        "message": "查询成功" if courses else "没有找到符合条件的课程",
    }
