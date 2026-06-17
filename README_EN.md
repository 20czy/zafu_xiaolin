<img width="1536" height="1024" alt="27849" src="https://github.com/user-attachments/assets/897b5eea-f58c-4236-8311-5344705d1ede" />

# Nonglin XiaoLin - Campus Brain Intelligent Decision-Making Agent

## 📝 Project Overview

Nonglin XiaoLin is a prototype of a "campus brain" intelligent decision-making Agent for university scenarios. The goal of this project is not merely to build a student Q&A chatbot, but to explore how data and capabilities scattered across academic affairs, student affairs, logistics, venues, notifications, user profiles, work orders, and other systems can be abstracted into schedulable Tools / Skills, forming a campus-level intelligent coordination layer.

Under this positioning, capabilities such as timetable lookup, notification retrieval, student profiles, and dorm repair requests are only foundational modules of the campus brain. The more important direction is enabling the Agent to understand complex campus-wide affairs, such as event coordination, resource scheduling, cross-department collaboration, operational situation analysis, and decision support.

For example, an administrator can express a goal in natural language:

> I want to hold a college lecture for around 200 people next Wednesday afternoon, mainly for 2023 Computer Science students. The venue should preferably be on the Donghu Campus. Help me plan the time, venue, notifications, and logistics arrangements.

An ideal campus brain should not only provide generic suggestions. It should automatically break down the task, check course conflicts, venue capacity, campus location, notification recipients, logistics items, and approval risks, then generate multiple comparable execution plans to reduce the burden of information collection, plan comparison, and cross-department coordination.

### 🦾 Project Demo

<img width="796" height="757" alt="截屏2026-06-03 16 33 14" src="https://github.com/user-attachments/assets/58307cc3-55c0-42e4-911d-f4a195ed25c8" />
<img width="796" height="750" alt="截屏2026-06-03 16 34 16" src="https://github.com/user-attachments/assets/f9b91c42-61ba-45aa-b1d4-b367e66ed266" />
<img width="797" height="753" alt="截屏2026-06-03 16 34 32" src="https://github.com/user-attachments/assets/a62f6203-54fd-48cb-90db-0f6caea7b9a4" />


### 🤔 Reasoning Flow

<img width="1672" height="941" alt="chain-thinking" src="https://github.com/user-attachments/assets/f358fef4-4f9a-462e-8b7c-9616a0bf6192" />

## 🎯 Application Scenarios

### Campus-Level Complex Affairs Coordination

- **Event planning and coordination**: Integrate course schedules, participants, venue capacity, campus location, notification recipients, and logistics requirements to generate event plans.
- **Resource conflict checking**: Check conflicts involving venues, classrooms, personnel schedules, university-level events, exams, and more, then provide alternative plans.
- **Cross-department collaboration**: Break a complex goal into multiple coordinated items involving academic affairs, student affairs, logistics, security, venue management, college notifications, and other departments.
- **Execution checklist generation**: Automatically organize approval items, material requirements, notification drafts, risk reminders, and pending confirmation points.

### Campus Operations and Governance Support

- **Operational situation analysis**: Aggregate data such as notifications, work orders, repair requests, events, venue usage, and course schedules to form a campus operations view.
- **Anomaly discovery**: Identify issues such as frequent repair requests, tight resources, notification backlogs, event conflicts, and service timeouts.
- **Decision support**: Generate plan comparisons, risk reminders, impact scope analysis, and handling recommendations based on multi-system data.
- **Process tracking**: Record task planning, tool selection, call results, and handling processes for auditing and review.

### Student and Faculty Service Entry Point

- **Student services**: Timetable lookup, campus notifications, dorm repair requests, administrative procedures, personalized reminders, and more.
- **Teacher and counselor services**: Class profiles, event organization, notification generation, student alerts, material preparation, and more.
- **Natural language access**: Consolidate complex system entry points into conversations, allowing different roles to invoke campus capabilities in a goal-driven way.

## ✨ Core Capabilities

- **Campus system abstraction**: Encapsulate capabilities from academic affairs, student affairs, logistics, venues, notifications, profiles, and more into unified Tools / Skills.
- **Multi-source data fusion**: Bring student profiles, course schedules, announcements, spatial resources, work order status, and other data into a shared context.
- **Task planning**: Break down complex campus affairs into executable and traceable task plans.
- **Tool orchestration**: Invoke capabilities such as courses, notifications, profiles, work orders, maps, knowledge bases, and external MCP Tools as needed.
- **Plan generation**: Generate comparable execution plans for scenarios such as event coordination, resource scheduling, and process collaboration.
- **Decision workload reduction**: Reduce the cost of manually checking systems, comparing plans, matching resources, and coordinating departments.
- **Process visualization**: Display the Agent's processing steps, tool choices, and intermediate results.
- **Lightweight deployment**: The demo uses FastAPI + SQLite + Next.js by default, making it convenient for demonstration and secondary development.

## 🧩 Extension Ideas

The project can connect to campus capabilities in two ways and gradually form an intelligent scheduling layer for campus governance:

- **Engineered API integration**: Suitable for production systems with strong permission, auditing, and stability requirements, such as login authentication, approvals, payments, course selection, and repair requests.
- **Tool-based capability integration**: Suitable for pluggable capabilities such as timetable lookup, notification retrieval, location lookup, and knowledge base Q&A, making rapid extension and demos easier.

The recommended approach is to use the "Campus Brain API" as the unified entry point. Internally, it encapsulates interfaces, permissions, logs, and rate limits from different systems; externally, it provides stable task planning, tool orchestration, and decision support capabilities. Student services can serve as a high-frequency entry point, but the higher-level goal of the project is to connect systems, fuse data, coordinate resources, and assist the university in handling complex affairs.

## 🧠 Agent Reasoning Flow

```text
Natural language goal
  ↓
Campus profile / user profile / scenario context
  ↓
Task Planner
  ↓
Tool Selector
  ↓
Skill Registry / MCP Tools
  ↓
Multi-system data query and execution
  ↓
Result aggregation / conflict checking / risk reminders
  ↓
Plan generation and decision support
```

Typical event coordination flow:

```text
"Hold a lecture for 200 people next Wednesday afternoon"
  ↓
Identify event goal, audience, time, scale, and campus preference
  ↓
Query target students' timetables and avoid course conflicts
  ↓
Query available venues and filter by capacity and campus
  ↓
Check university-level events, exams, logistics, and approval risks
  ↓
Generate multiple alternative plans, notification drafts, and execution checklists
```

## 🛠️ Skill Integration Guide

The demo backend supports extending campus capabilities through local Skills. A Skill is a capability description package that can be discovered, selected, and executed by the Agent. It usually contains:

- `SKILL.md`: Describes the Skill name, applicable scenarios, input parameters, output format, and execution method.
- `references/`: Optional local reference data, such as notification indexes, announcement content, and sample data.
- Local execution function: Bound to a specific Python handler in `fastapi/app/skills/registry.py`.

After a user sends a request, the system first performs task planning, then selects suitable capabilities from MCP Tools and local Skills. If a local Skill is matched, `TaskExecutor` prioritizes the local handler to avoid unnecessary remote tool calls.

### Currently Integrated MCP Tool

| MCP Server | Tool | Scenario | Data Source |
| --- | --- | --- | --- |
| `weather` | `campus_weather` | Query current weather and 1-7 day forecasts for Hangzhou, Lin'an, Zhejiang A&F University, Donghu Campus, Yijin Campus, and related locations | Local MCP Server wrapping the Open-Meteo weather API, with no extra API Key required |

### Currently Integrated Skills

| Skill | Scenario | Data Source | Entry Point |
| --- | --- | --- | --- |
| `course-schedule` | Query timetables, course times, classrooms, instructors, majors, grades, classes, campuses, semesters, and more | Local timetable API mock data for multiple majors and classes; when no major is explicitly specified, the student profile is used for default retrieval | `GET /api/v1/course-schedule/` |
| `campus-notice` | Query the latest campus notifications, scholarships, semester-start items, sports meeting notices, academic affairs, safety notices, library services, and more | Built-in Skill mock data from `references/notices.json` and `notice-*.md` | `GET /api/v1/campus-notices/` |
| `venue-booking` | Query campus venues, filter by capacity/campus/equipment/time slot, and generate mock venue reservation forms | Local venue and reservation mock data, supporting availability and conflict checks | `GET /api/v1/venues/` / `POST /api/v1/venues/reservations` |

### Student Profile Context

The demo includes a mock student profile document to simulate personal basic information in a real campus system:

```text
fastapi/app/data/student_profile.md
```

The current profile fields include: name, student ID, college, major, grade, class, advisor, campus, dormitory, and contact information. The backend reads this document and injects the profile into task planning, tool selection, and the final response prompt, allowing questions such as "my timetable", "which campus should I handle this on", and "who is my advisor" to be answered in the context of the current student identity.

To avoid excessive exposure of personal information, the prompt explicitly requires that the profile be used only as context and not actively repeated in full. Sensitive fields such as phone number and dormitory should not be output unless the user explicitly asks.

Read-only student profile API:

```text
GET /api/v1/student-profile/
```

### Timetable Profile-Based Retrieval

When the user does not explicitly provide a major, course, instructor, or other retrieval scope, the `course-schedule` Skill automatically supplements default conditions from the student profile:

- `major`: `专业` from the profile
- `grade`: `年级` from the profile
- `class_name`: `班级` from the profile

For example, if the current mock profile is `Computer Science and Technology / 2023 / CS2301`, and the user asks "Check my Tuesday classes", the Skill calls the timetable API using that major, grade, and class, then returns the Tuesday courses and shared public courses for that class.

Main query parameters supported by the timetable API:

| Parameter | Description |
| --- | --- |
| `major` | Major name, for example `Computer Science and Technology` or `Forestry` |
| `grade` | Grade, for example `2023` or `2023级` |
| `class_name` | Class name, for example `计科2301班` |
| `semester` | Semester, for example `2025-2026-1` |
| `day_of_week` | Day of week, for example `周一`, `1`, `today`, or `tomorrow` |
| `course_id` | Course ID |
| `course_name` | Course name keyword |
| `teacher` / `instructor` | Instructor |
| `campus` | Campus, for example `Donghu Campus` |

### Skill Directory Structure

```text
fastapi/app/data/
└── student_profile.md          # Mock student profile document
fastapi/app/skills/
├── registry.py                # Skill registration, discovery, aliases, and execution entry point
├── schedule.py                # course-schedule execution function
├── notice.py                  # campus-notice execution function
├── course-schedule/
│   └── SKILL.md
└── campus-notice/
    ├── SKILL.md
    └── references/
        ├── notices.json
        └── notice-2026-*.md
```

### Basic Steps for Adding a New Skill

1. Create a directory under `fastapi/app/skills/` named after the Skill, for example `library-seat/`.
2. Add `SKILL.md` in the directory and declare `name`, `description`, input parameters, output format, and execution method.
3. If local mock data is needed, add `references/` under the Skill directory.
4. Add the corresponding execution function file under `fastapi/app/skills/`, and bind it in `_handlers` in `registry.py`.
5. If aliases are needed, add Chinese or historical name mappings in `_aliases` in `registry.py`.
6. Add tests to ensure the Skill can be discovered by `SkillRegistry.list_tools()` and executed through `SkillRegistry.execute_tool()`.

### Capability List

The tool button in the upper-right corner of the chat page can open the current capability panel directly, showing integrated MCP Tools and local Skills. The backend also provides a capability list API:

```text
GET /api/v1/capabilities/
```

Common capability APIs:

```text
GET /api/v1/course-schedule/
GET /api/v1/campus-notices/
GET /api/v1/student-profile/
GET /api/v1/venues/
POST /api/v1/venues/reservations
GET /api/v1/capabilities/
```

## 💻 Project Architecture

```text
Project root/
├── fastapi/          # Demo backend: FastAPI + SQLite
│   ├── app/
│   │   ├── agent/    # Agent system components
│   │   ├── api/      # API routes
│   │   ├── core/     # Core configuration
│   │   ├── data/     # Local mock documents such as student profiles
│   │   ├── db/       # Database-related code
│   │   ├── schemas/  # Pydantic models
│   │   ├── skills/   # Local Skill capability packages
│   │   └── services/ # Service layer
│   └── app/main.py   # Application entry point
├── frontend/my-app/  # Next.js frontend
├── docker-compose.yml
└── docker-compose.prod.yml
```

### Demo Architecture

```text
Users / Administrators / Teachers / Students
  ↓
Next.js frontend
  ↓
FastAPI Campus Brain API
  ↓
Agent orchestration layer: task planning / tool selection / execution tracing / result aggregation
  ↓
Skill & Tool layer: timetable / notifications / profiles / work orders / venues / maps / knowledge base
  ↓
Data and system layer: SQLite mock / campus business system APIs / external MCP Tools
```

## 🚀 Running the Project

### Prerequisites

- Python 3.8+
- Node.js and npm
- Docker and Docker Compose (optional)

### Method 1: Local Quick Start (Recommended)

By default, the demo starts only two services: the frontend and FastAPI. Data is stored in `fastapi/demo.db`, and tables are created automatically on first startup.

```bash
# Run from the project root
npm install
npm --prefix frontend/my-app install
pip install -r fastapi/requirements.txt
npm run dev
```

Service URLs:

- Frontend: http://localhost:3000
- API: http://localhost:8001
- API docs: http://localhost:8001/docs

### Method 2: Docker Compose

```bash
docker-compose up --build
```

You can also use the script:

```bash
./quick-start.sh
```

### Environment Variables

After the first deployment, configure the LLM first. Create `fastapi/.env` and provide at least one available model key:

```text
DEEPSEEK_API_KEY=your_deepseek_api_key
# Optional: GLM_API_KEY=your_glm_api_key
DATABASE_URL=sqlite+aiosqlite:///./demo.db
```

### Accessing the App

- App entry: http://localhost:3000
- Chat page: http://localhost:3000/chat

The demo has removed the login guard. After deployment, opening the app will take you directly to the chat page. If no LLM key is detected, the chat interface will prompt you to configure `DEEPSEEK_API_KEY` in `fastapi/.env` and restart the API service.

## 🔄 Demo Simplification Notes

To reduce deployment cost, the demo now keeps only the FastAPI backend, Next.js frontend, and local SQLite data:

- FastAPI automatically creates SQLite tables on startup
- All frontend requests go through `NEXT_PUBLIC_API_BASE_URL`, which defaults to `http://localhost:8001`
- Production deployment can use `docker-compose.prod.yml` for persistent volumes and the gateway

## 💡 Future Roadmap

### Application Capabilities

- [x] Mock student profile and prompt injection
- [x] Timetable lookup based on student profile
- [ ] Campus notification summarization and todo extraction
- [ ] Campus event coordination planning Agent
- [ ] Venue / classroom resource query and conflict detection
- [ ] Automatic generation of event notification drafts, logistics checklists, and approval items
- [ ] Dorm repair requests and logistics work order scheduling
- [ ] Campus operations status Q&A and anomaly analysis
- [ ] Cross-department affair breakdown and process tracking
- [ ] Exam and grade lookup
- [ ] Empty classroom, library seat, and campus location lookup
- [ ] Academic risk warning and personalized recommendations
- [ ] Class profiles and weekly reports for teachers/counselors

### Engineering Capabilities

- [ ] Unified identity authentication and role permissions
- [ ] Multi-role data permissions and sensitive information protection
- [ ] Tool call audit logs
- [ ] External system API adapter layer
- [ ] Campus knowledge base retrieval
- [ ] Agent task execution status tracking
- [ ] Multi-system data fusion and unified resource model
- [ ] Decision plan scoring, conflict detection, and risk reminders
- [ ] Production database and cache support

## 📞 Contact

If you are interested in this project or have any questions, please contact me by [email](mailto:3092492683@qq.com) or QQ: 3092492683.
