# 农林小林 (XiaoLin) - 校园大脑 AI 助手 

<p align="center">
    <img alt="xiaolin" width="200" style="border-radius: 10px;" src="https://github.com/user-attachments/assets/2cb3cc13-fce5-4312-909c-fa93129685ca">
</p>

## 📝 项目简介

农林小林是一个面向高校场景的“校园大脑”AI 助手，目标是把分散在教务、学工、后勤、图书馆、通知公告等系统里的信息，统一成一个可以自然语言交互的校园入口。

用户不需要记住系统入口、菜单路径和复杂流程，只需要像聊天一样提出问题或需求，例如“明天有哪些课”“帮我总结这条通知”“哪里有空教室”“宿舍网络坏了怎么报修”。系统会结合对话、任务规划和工具调用，返回可执行、可追踪的结果。

### 🦾 项目演示

[查看演示视频](https://github.com/user-attachments/assets/89f6fd26-3d2b-4d25-a6b3-afe34c89fa88)

## 🎯 应用场景

### 学生服务

- **校园问答**：查询校历、考试安排、规章制度、办事流程、通知公告。
- **学习助手**：查询课表、成绩、培养方案，生成学习建议和复习计划。
- **生活服务**：查询空教室、图书馆座位、校车、食堂、校园地点。
- **事务办理**：请假、报修、活动报名、证明申请、材料清单检查。

### 教师与辅导员

- **班级画像**：汇总学生考勤、成绩、预警、活动参与等信息。
- **教学辅助**：生成课程通知、课堂总结、作业反馈和教学周报。
- **学生预警**：识别学业风险、缺勤异常、心理关注线索，辅助跟进。
- **材料处理**：总结政策文件、整理申报材料、生成沟通草稿。

### 学校管理

- **运行看板**：汇总报修、能耗、门禁、网络、舆情、服务工单等数据。
- **智能检索**：自然语言查询跨部门数据和历史文档。
- **流程协同**：把用户诉求自动分派到对应部门，并跟踪处理进展。
- **决策辅助**：对校园运行问题进行归因、趋势分析和风险提醒。

## ✨ 核心能力

- **自然语言交互**：把校园系统能力封装成对话式入口。
- **任务规划**：对复杂问题进行拆解，逐步完成查询、分析和回复。
- **工具调用**：按需调用课程、通知、工单、地图、知识库等外部能力。
- **过程可视化**：展示智能体的处理步骤、工具选择和中间结果。
- **会话记忆**：保存聊天历史和上下文，支持连续追问。
- **轻量部署**：Demo 默认使用 FastAPI + SQLite + Next.js，方便演示和二次开发。

## 🧩 扩展思路

项目可以通过两类方式接入校园能力：

- **工程化 API 接入**：适合登录鉴权、审批、缴费、选课、报修等强权限、强审计、强稳定性的生产系统。
- **工具化能力接入**：适合课表查询、通知检索、地点查询、知识库问答等可插拔能力，便于快速扩展和演示。

推荐做法是将“校园大脑 API”作为统一入口，对内封装不同系统的接口、权限、日志和限流，对外提供稳定的对话和工具调用能力。

## 🛠️ Skill 接入说明

Demo 后端支持通过本地 Skill 扩展校园能力。Skill 是一个可被智能体发现、选择和执行的能力描述包，通常包含：

- `SKILL.md`：描述 Skill 的名称、适用场景、输入参数、输出格式和执行方式。
- `references/`：可选的本地参考数据，例如通知索引、公告正文、示例数据。
- 本地执行函数：在 `fastapi/app/skills/registry.py` 中绑定到具体 Python handler。

当用户发起请求后，系统会先进行任务规划，再在 MCP Tool 和本地 Skill 中选择合适能力。若命中本地 Skill，`TaskExecutor` 会优先调用本地 handler，避免不必要的远程工具调用。

### 当前已接入 Skill

| Skill | 场景 | 数据来源 | 入口 |
| --- | --- | --- | --- |
| `course-schedule` | 查询课表、课程时间、教室、任课教师、专业、年级、班级、校区、学期等 | 多专业/多班级本地课程表 API mock 数据；未显式指定专业时会使用学生画像默认检索 | `GET /api/v1/course-schedule/` |
| `campus-notice` | 查询最新校园通知、奖学金、开学事项、运动会、教务、安全、图书馆服务等通知 | Skill 自带 `references/notices.json` 与 `notice-*.md` mock 数据 | `GET /api/v1/campus-notices/` |

### 学生画像上下文

Demo 内置了一份学生画像 mock 文档，用来模拟真实校园系统中的个人基础信息：

```text
fastapi/app/data/student_profile.md
```

当前画像字段包括：姓名、学号、学院、专业、年级、班级、导师、校区、宿舍、联系方式。后端会读取该文档并把画像注入到任务规划、工具选择和最终回复 prompt 中，让“我的课表”“我在哪个校区办理”“我的导师是谁”等问题可以结合当前学生身份回答。

为了避免过度暴露个人信息，prompt 中明确要求：画像只作为上下文，不主动完整复述；除非用户明确询问，否则不输出手机号、宿舍等敏感字段。

学生画像只读接口：

```text
GET /api/v1/student-profile/
```

### 课表画像检索

`course-schedule` Skill 会在用户没有显式提供专业、课程、教师等检索范围时，自动从学生画像补充默认条件：

- `major`: 画像中的 `专业`
- `grade`: 画像中的 `年级`
- `class_name`: 画像中的 `班级`

例如，当前 mock 画像为 `计算机科学与技术 / 2023级 / 计科2301班`，用户询问“查一下我周二的课”，Skill 会按该专业、年级和班级调用课表 API，并返回该班周二课程及本班公共课。

课表 API 支持的主要查询参数：

| 参数 | 说明 |
| --- | --- |
| `major` | 专业名称，例如 `计算机科学与技术`、`林学` |
| `grade` | 年级，例如 `2023` 或 `2023级` |
| `class_name` | 班级，例如 `计科2301班` |
| `semester` | 学期，例如 `2025-2026-1` |
| `day_of_week` | 星期，例如 `周一`、`1`、`今天`、`明天` |
| `course_id` | 课程编号 |
| `course_name` | 课程名称关键词 |
| `teacher` / `instructor` | 任课教师 |
| `campus` | 校区，例如 `东湖校区` |

### Skill 目录结构

```text
fastapi/app/data/
└── student_profile.md          # 学生画像 mock 文档
fastapi/app/skills/
├── registry.py                # Skill 注册、发现、别名和执行入口
├── schedule.py                # course-schedule 执行函数
├── notice.py                  # campus-notice 执行函数
├── course-schedule/
│   └── SKILL.md
└── campus-notice/
    ├── SKILL.md
    └── references/
        ├── notices.json
        └── notice-2026-*.md
```

### 新增 Skill 的基本步骤

1. 在 `fastapi/app/skills/` 下创建一个以 Skill 名称命名的目录，例如 `library-seat/`。
2. 在目录中添加 `SKILL.md`，声明 `name`、`description`、输入参数、输出格式和执行方式。
3. 如需本地 mock 数据，可在该 Skill 目录下添加 `references/`。
4. 在 `fastapi/app/skills/` 下添加对应执行函数文件，并在 `registry.py` 的 `_handlers` 中绑定。
5. 如有别名需求，在 `registry.py` 的 `_aliases` 中添加中文或历史名称映射。
6. 添加测试，确保 Skill 能被 `SkillRegistry.list_tools()` 发现，并能通过 `SkillRegistry.execute_tool()` 执行。

### 能力查看

聊天页右上角的工具按钮可以直接打开当前接入能力面板，查看已接入的 MCP Tool 和本地 Skill。后端也提供能力清单接口：

```text
GET /api/v1/capabilities/
```

常用能力接口：

```text
GET /api/v1/course-schedule/
GET /api/v1/campus-notices/
GET /api/v1/student-profile/
GET /api/v1/capabilities/
```

## 💻 项目架构

```
项目根目录/
├── fastapi/          # Demo 后端：FastAPI + SQLite
│   ├── app/
│   │   ├── agent/    # 代理系统组件
│   │   ├── api/      # API路由
│   │   ├── core/     # 核心配置
│   │   ├── data/     # 学生画像等本地 mock 文档
│   │   ├── db/       # 数据库相关
│   │   ├── schemas/  # Pydantic模型
│   │   ├── skills/   # 本地 Skill 能力包
│   │   └── services/ # 服务层
│   └── app/main.py   # 应用入口
├── frontend/my-app/  # Next.js 前端
└── backend/          # 历史 Django 实现，demo 默认不启动
```

### Demo 架构

```text
用户
  ↓
Next.js 前端
  ↓
FastAPI 校园大脑 API
  ↓
智能体编排层
  ↓
本地 SQLite / 校园系统 API / 可插拔工具
```

## 🚀 运行项目

### 前提条件

- Python 3.8+
- Node.js 和 npm
- Docker 和 Docker Compose（可选）

### 方法一：本地快速启动（推荐）

demo 默认只启动两个服务：前端和 FastAPI。数据保存在 `fastapi/demo.db`，首次启动会自动建表。

```bash
# 在项目根目录执行
npm install
npm --prefix frontend/my-app install
pip install -r fastapi/requirements.txt
npm run dev
```

服务地址：

- 前端：http://localhost:3000
- API：http://localhost:8001
- API 文档：http://localhost:8001/docs

### 方法二：Docker Compose

```bash
docker-compose up --build
```

也可以使用脚本：

```bash
./quick-start.sh
```

### 环境变量配置

首次部署后请先配置 LLM。创建 `fastapi/.env`，至少填写一个可用的模型密钥：

```
DEEPSEEK_API_KEY=your_deepseek_api_key
# 可选：GLM_API_KEY=your_glm_api_key
DATABASE_URL=sqlite+aiosqlite:///./demo.db
```

### 访问应用

- 应用入口: http://localhost:3000
- 聊天页面: http://localhost:3000/chat

Demo 已移除登录拦截，部署完成后打开应用会直接进入聊天。如果未检测到 LLM 密钥，聊天界面会提示需要在 `fastapi/.env` 中配置 `DEEPSEEK_API_KEY` 并重启 API 服务。

## 🔄 Demo 简化说明

为了降低部署成本，demo 默认去掉了运行时对 Django、PostgreSQL、Redis 和 Alembic 迁移的依赖：

- FastAPI 启动时自动创建 SQLite 表
- 前端所有请求统一走 `NEXT_PUBLIC_API_BASE_URL`，默认 `http://localhost:8001`
- `backend/` 保留为历史实现，后续如果要做生产版再接回独立数据库和鉴权

## 💡 未来规划 (RoadMap)

### 应用能力
- [ ] 校园通知总结与待办提取
- [x] 学生画像 mock 与 prompt 注入
- [x] 基于学生画像的课表查询
- [ ] 考试、成绩查询
- [ ] 空教室、图书馆座位、校园地点查询
- [ ] 报修工单创建与进度查询
- [ ] 学业风险预警与个性化建议
- [ ] 面向教师/辅导员的班级画像和周报

### 工程能力
- [ ] 统一身份认证与角色权限
- [ ] 工具调用审计日志
- [ ] 外部系统 API 适配层
- [ ] 校园知识库检索
- [ ] 智能体任务执行状态追踪
- [ ] 生产环境数据库与缓存支持


## 📞 联系方式

如果您对该项目感兴趣或有任何疑问，可以通过[邮箱](mailto:3092492683@qq.com)或是QQ：3092492683联系我。
