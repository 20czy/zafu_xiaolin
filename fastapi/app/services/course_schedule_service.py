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
        "instructor": "张教授",
        "major": "计算机科学",
        "semester": "2023-2024-2",
        "day_of_week": 1,
        "start_time": "08:00",
        "end_time": "09:40",
        "classroom": "A101",
    },
    {
        "course_id": "CS102",
        "course_name": "数据结构",
        "instructor": "李教授",
        "major": "计算机科学",
        "semester": "2023-2024-2",
        "day_of_week": 2,
        "start_time": "10:00",
        "end_time": "11:40",
        "classroom": "A102",
    },
    {
        "course_id": "EE101",
        "course_name": "电路原理",
        "instructor": "王教授",
        "major": "电子信息",
        "semester": "2023-2024-2",
        "day_of_week": 1,
        "start_time": "10:00",
        "end_time": "11:40",
        "classroom": "B101",
    },
    {
        "course_id": "EE102",
        "course_name": "数字电路",
        "instructor": "刘教授",
        "major": "电子信息",
        "semester": "2023-2024-2",
        "day_of_week": 3,
        "start_time": "14:00",
        "end_time": "15:40",
        "classroom": "B102",
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
