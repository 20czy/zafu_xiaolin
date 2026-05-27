<p align="center">
    <img alt="农林小林 XiaoLin - Campus Brain Decision Agent" src="media/readme-hero.png">
</p>

# 农林小林 (XiaoLin) - 校园大脑智能决策 Agent

## 📝 项目简介

农林小林是一个面向高校场景的“校园大脑”智能决策 Agent 原型。项目目标不是只做一个学生问答机器人，而是探索如何把分散在教务、学工、后勤、场馆、通知、人员画像、工单等系统中的数据与能力统一抽象为可调度的 Tool / Skill，从而形成一个校园级智能协调层。

在这个定位下，课表查询、通知检索、学生画像、宿舍报修等能力只是校园大脑的基础模块。更核心的方向是让 Agent 能够理解校园范围内的复杂事务，例如活动统筹、资源调度、跨部门协同、运行态势分析和决策辅助。

例如，管理者可以用自然语言提出目标：

> 下周三下午想办一场 200 人左右的学院讲座，主要面向 2023 级计科学生，地点尽量在东湖校区，帮我规划时间、场地、通知和后勤安排。

理想中的校园大脑不只是给出泛泛建议，而是自动拆解任务，查询课程冲突、场地容量、校区位置、通知对象、后勤事项和审批风险，最终生成多个可比较的执行方案，减轻信息收集、方案对比和跨部门协调的负担。

### 🦾 项目演示

[查看演示视频](https://github.com/user-attachments/assets/89f6fd26-3d2b-4d25-a6b3-afe34c89fa88)

### 🤔 思考链路
<img width="1672" height="941" alt="chain-thinking" src="https://github.com/user-attachments/assets/f358fef4-4f9a-462e-8b7c-9616a0bf6192" />

## 🎯 应用场景

### 校园级复杂事务统筹

- **活动统筹规划**：综合课程安排、参与对象、场地容量、校区位置、通知对象和后勤需求，生成活动方案。
- **资源冲突检查**：检查场馆、教室、人员时间、校级活动、考试安排等冲突，给出替代方案。
- **跨部门协同**：把一个复杂目标拆解为教务、学工、后勤、保卫、场馆管理、学院通知等多个协同事项。
- **执行清单生成**：自动整理审批事项、物资需求、通知文案、风险提示和待确认节点。

### 校园运行与治理辅助

- **运行态势分析**：汇总通知、工单、报修、活动、场馆使用、课程安排等数据，形成校园运行视图。
- **异常问题发现**：识别高频报修、资源紧张、通知积压、活动冲突、服务超时等问题。
- **决策辅助**：基于多系统数据生成方案比较、风险提醒、影响范围分析和处置建议。
- **流程追踪**：记录任务规划、工具选择、调用结果和处理过程，便于审计和复盘。

### 学生与教师服务入口

- **学生服务**：课表查询、校园通知、宿舍报修、办事流程、个性化提醒等。
- **教师与辅导员服务**：班级画像、活动组织、通知生成、学生预警、材料整理等。
- **自然语言访问**：把复杂系统入口收敛到对话中，让不同角色以目标驱动的方式调用校园能力。

## ✨ 核心能力

- **校园系统抽象**：将教务、学工、后勤、场馆、通知、画像等能力封装为统一的 Tool / Skill。
- **多源数据融合**：把学生画像、课程安排、通知公告、空间资源、工单状态等数据纳入同一上下文。
- **任务规划**：对复杂校园事务进行拆解，形成可执行、可追踪的任务计划。
- **工具调度**：按需调用课程、通知、画像、工单、地图、知识库、外部 MCP Tool 等能力。
- **方案生成**：面向活动统筹、资源调度、流程协同等场景生成可比较的执行方案。
- **决策减负**：减少人工查系统、比方案、对资源、协调部门的成本。
- **过程可视化**：展示智能体的处理步骤、工具选择和中间结果。
- **轻量部署**：Demo 默认使用 FastAPI + SQLite + Next.js，方便演示和二次开发。

## 🧩 扩展思路

项目可以通过两类方式接入校园能力，并逐步形成面向校园治理的智能调度层：

- **工程化 API 接入**：适合登录鉴权、审批、缴费、选课、报修等强权限、强审计、强稳定性的生产系统。
- **工具化能力接入**：适合课表查询、通知检索、地点查询、知识库问答等可插拔能力，便于快速扩展和演示。

推荐做法是将“校园大脑 API”作为统一入口，对内封装不同系统的接口、权限、日志和限流，对外提供稳定的任务规划、工具调度和决策辅助能力。学生服务可以作为高频入口，但项目的上位目标是打通系统、融合数据、协调资源，并辅助学校处理复杂事务。

## 🧠 Agent 思考链路

```text
自然语言目标
  ↓
校园画像 / 用户画像 / 场景上下文
  ↓
Task Planner 任务规划
  ↓
Tool Selector 能力选择
  ↓
Skill Registry / MCP Tools
  ↓
多系统数据查询与执行
  ↓
结果汇总 / 冲突检查 / 风险提示
  ↓
方案生成与决策辅助
```

典型活动统筹链路：

```text
“下周三下午办一场 200 人讲座”
  ↓
识别活动目标、对象、时间、规模、校区偏好
  ↓
查询目标学生课表，避开课程冲突
  ↓
查询可用场地，筛选容量和校区
  ↓
检查校级活动、考试、后勤和审批风险
  ↓
生成多个备选方案、通知文案和执行清单
```

## 🛠️ Skill 接入说明

Demo 后端支持通过本地 Skill 扩展校园能力。Skill 是一个可被智能体发现、选择和执行的能力描述包，通常包含：

- `SKILL.md`：描述 Skill 的名称、适用场景、输入参数、输出格式和执行方式。
- `references/`：可选的本地参考数据，例如通知索引、公告正文、示例数据。
- 本地执行函数：在 `fastapi/app/skills/registry.py` 中绑定到具体 Python handler。

当用户发起请求后，系统会先进行任务规划，再在 MCP Tool 和本地 Skill 中选择合适能力。若命中本地 Skill，`TaskExecutor` 会优先调用本地 handler，避免不必要的远程工具调用。

### 当前已接入 MCP Tool

| MCP Server | Tool | 场景 | 数据来源 |
| --- | --- | --- | --- |
| `weather` | `campus_weather` | 查询杭州、临安、浙江农林大学、东湖校区、衣锦校区等地当前天气和未来 1-7 天天气预报 | 本地 MCP Server 封装 Open-Meteo 天气接口，无需额外 API Key |

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
用户 / 管理者 / 教师 / 学生
  ↓
Next.js 前端
  ↓
FastAPI 校园大脑 API
  ↓
Agent 编排层：任务规划 / 工具选择 / 执行追踪 / 结果汇总
  ↓
Skill & Tool 层：课表 / 通知 / 画像 / 工单 / 场馆 / 地图 / 知识库
  ↓
数据与系统层：SQLite mock / 校园业务系统 API / 外部 MCP Tool
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
- [x] 学生画像 mock 与 prompt 注入
- [x] 基于学生画像的课表查询
- [ ] 校园通知总结与待办提取
- [ ] 校园活动统筹规划 Agent
- [ ] 场馆 / 教室资源查询与冲突检测
- [ ] 活动通知文案、后勤清单、审批事项自动生成
- [ ] 宿舍报修与后勤工单调度
- [ ] 校园运行状态问答与异常分析
- [ ] 跨部门事务拆解与流程追踪
- [ ] 考试、成绩查询
- [ ] 空教室、图书馆座位、校园地点查询
- [ ] 学业风险预警与个性化建议
- [ ] 面向教师/辅导员的班级画像和周报

### 工程能力
- [ ] 统一身份认证与角色权限
- [ ] 多角色数据权限与敏感信息保护
- [ ] 工具调用审计日志
- [ ] 外部系统 API 适配层
- [ ] 校园知识库检索
- [ ] 智能体任务执行状态追踪
- [ ] 多系统数据融合与统一资源模型
- [ ] 决策方案评分、冲突检测和风险提示
- [ ] 生产环境数据库与缓存支持


## 📞 联系方式

如果您对该项目感兴趣或有任何疑问，可以通过[邮箱](mailto:3092492683@qq.com)或是QQ：3092492683联系我。
