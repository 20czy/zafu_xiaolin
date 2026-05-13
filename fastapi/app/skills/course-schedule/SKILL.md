---
name: course-schedule
description: 查询浙江农林大学课程表。用于用户询问课表、某专业某学期课程、某天课程、课程地点、任课教师或课程编号时。
---

# Course Schedule

Use this skill when the user asks about course schedules, class times, classrooms, instructors, majors, semesters, or course IDs.

## Inputs

The caller may provide any of these optional filters:

- `major`: major name, such as `计算机科学` or `电子信息`
- `semester`: semester code, such as `2023-2024-2`
- `day_of_week`: weekday as `1`-`7`, `周一`-`周日`, `今天`, or `明天`
- `course_id`: course code, such as `CS101`
- `course_name`: course name keyword, such as `数据结构`
- `teacher` or `instructor`: instructor keyword

## Output

Return matching courses with course ID, course name, instructor, major, semester, weekday, time, and classroom. If no course matches, say that no accurate schedule was found for the provided filters.

## Execution

This skill obtains schedule data from the local course schedule API:

`GET /api/v1/course-schedule/`

Pass the optional filters as query parameters. The API currently returns mock course data for development and demos.
