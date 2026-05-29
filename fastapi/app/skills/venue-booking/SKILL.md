---
name: venue-booking
description: 查询校园场地并生成 mock 场地预约单。用于用户规划讲座、会议、培训、活动、场馆借用、容量筛选、校区筛选、设备要求和时段冲突检查时。
---

# Venue Booking

Use this skill when the user asks to find, compare, or reserve campus venues for lectures, meetings, trainings, salons, activity planning, or campus resource coordination.

## Inputs

The caller may provide these optional filters:

- `action`: `query` for venue search, `reserve` for mock reservation. Defaults to `query`.
- `campus`: campus preference, such as `东湖校区` or `衣锦校区`.
- `capacity_min` or `attendee_count`: minimum venue capacity or expected audience size.
- `date`: target date in `YYYY-MM-DD`.
- `period` or `time_range`: target time range, such as `15:30-17:30`.
- `venue_type`: venue category, such as `报告厅`, `阶梯教室`, `多功能厅`.
- `event_type`: event type, such as `讲座`, `培训`, `会议`.
- `equipment`: required equipment, either a list or comma-separated text, such as `投影,音响,无线麦克风`.

For reservation, provide:

- `venue_id`: selected venue ID.
- `date`: reservation date.
- `period`: reservation time range.
- `event_name`: event title.
- `attendee_count`: expected audience size.
- `requester` / `department`: optional requester information.

## Output

For query requests, return matching venues with venue ID, name, campus, building, capacity, venue type, equipment, managing department, contact, availability, conflicts, and recommendation score.

For reservation requests, return a mock booking ID, selected venue, approval status, contact department, conflict details if any, and next-step checklist.

## Execution

This skill calls the local venue API and mock venue data:

- `GET /api/v1/venues/`: query venues and availability.
- `POST /api/v1/venues/reservations`: create a mock reservation order.

The current implementation uses local mock venue and booking data for campus brain demos. It does not create real reservations in school systems.
