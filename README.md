# 农林小林 (XiaoLin) - 基于 MCP 的全栈校园 AI 助手

<p align="center">
    <img alt="xiaolin" width="200" style="border-radius: 10px;" src="https://github.com/user-attachments/assets/2cb3cc13-fce5-4312-909c-fa93129685ca">
</p>

## 📝 项目简介

农林小林是面向校园和教育场景的全栈智能助手解决方案框架，专为浙江农林大学开发。灵感来源于论文: [HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in HuggingFace](http://arxiv.org/abs/2303.17580)。

项目使用自然语言作为大语言模型(LLM)沟通的媒介，集成了任务规划✍️和工具调用🔧为一体，专注于对接现有校园系统，高效解决校园范围内的复杂问题🤔。本项目实现了 Model Context Protocol (MCP) 客户端，使 AI 助手能够无缝连接并利用校园内的各种数据源和工具。

### 🦾 项目演示

[查看演示视频](https://github.com/user-attachments/assets/89f6fd26-3d2b-4d25-a6b3-afe34c89fa88)

## 💡 MCP 集成

农林小林实现了 Model Context Protocol (MCP) 客户端，为项目提供了强大的外部数据访问能力。

### 什么是 MCP?

Model Context Protocol (简称 MCP，中文称为模型上下文协议) 是由 Anthropic 推动的开放标准协议，旨在为大型语言模型 (LLMs) 提供一个标准化接口，使其能够连接并交互外部数据源和工具，克服 LLMs 仅依赖训练数据的局限性。

### MCP 核心优势

* **连接外部数据和工具**：允许 LLMs 动态获取所需的上下文信息，如数据库记录、文件内容、API 数据等
* **标准化通信协议**：定义统一的通信格式，使 AI 应用能够以一致的方式与各种外部系统交互
* **安全性和隐私保护**：在本地运行服务器，避免敏感数据上传至第三方
* **灵活性和可扩展性**：支持多种数据源和工具的集成，便于构建复杂的 AI 工作流

### 在农林小林中的应用

作为 MCP 客户端，农林小林能够：

1. **校园数据集成**：无缝连接学校的各种数据系统，如教务系统、图书馆系统、学生信息系统等
2. **实时信息获取**：获取最新的校园通知、课程信息、活动安排等
3. **个性化服务**：根据学生的个人数据提供定制化的学习建议和校园生活指导
4. **安全数据处理**：确保敏感学生数据在本地处理，保护隐私和安全

### MCP 架构集成

农林小林项目采用 MCP 的客户端-服务器架构：

* **MCP 客户端**：嵌入在农林小林应用中，负责与 MCP 服务器建立通信会话
* **MCP 服务器**：连接校园各系统，按照 MCP 协议规范暴露标准化功能接口
* **宿主应用**：农林小林 AI 助手，集成 MCP 客户端，使模型能够调用校园数据和工具

通过 MCP 集成，农林小林实现了一个真正的"知校园、懂校园"的 AI 助手，能够提供更加精准、实时的校园服务。

## 💻 项目架构

```
项目根目录/
├── backend/          # Django 后端
│   └── chatbot/      # 核心聊天机器人应用
├── fastapi/          # FastAPI 后端实现
│   ├── app/
│   │   ├── agent/    # 代理系统组件
│   │   ├── api/      # API路由
│   │   ├── core/     # 核心配置
│   │   ├── db/       # 数据库相关
│   │   ├── schemas/  # Pydantic模型
│   │   ├── services/ # 服务层
│   │   └── mcp/      # MCP 客户端实现
│   ├── alembic/      # 数据库迁移
│   └── main.py       # 应用入口
└── frontend/         # 前端应用
```

## 🚀 运行项目

### 前提条件

- Python 3.8+
- Node.js 和 npm
- Redis 服务
- MCP 服务器 (用于连接校园数据系统)

### 1. 运行 Redis

确保 Redis 服务在本地 6379 端口运行:

```bash
# Windows用户可使用Docker
docker pull redis
docker run -d -p 6379:6379 --name my_redis redis
```

### 2. 启动后端服务

在项目根目录下执行:

```bash
# 安装Python依赖
pip install -r requirements.txt

# 启动后端服务
cd backend/
python manage.py runserver
```

### 3. 启动前端服务

```bash
# 安装前端依赖
cd frontend/
npm install

# 启动前端开发服务器
npm run dev
```

### 4. 环境变量配置

修改 `backend/chatbot/.env` 文件，设置以下变量:

```
DEEPSEEK_API_KEY=your_deepseek_api_key
MCP_SERVER_URL=http://localhost:8080  # MCP 服务器地址
MCP_API_KEY=your_mcp_api_key  # 如果需要
```

或者，如果使用FastAPI版本，创建 `fastapi/.env` 文件:

```
DEEPSEEK_API_KEY=your_deepseek_api_key
DATABASE_URL=sqlite:///./app.db
MCP_SERVER_URL=http://localhost:8080
MCP_API_KEY=your_mcp_api_key
```

### 5. 访问应用

- 登录页面: http://localhost:3000/login (默认账号/密码: root/123456)
- 聊天页面: http://localhost:3000/chat

## 🔄 FastAPI 版本说明

项目提供了基于 FastAPI 的替代后端实现，具有以下特点:

1. **异步支持**: 原生支持异步编程，适合处理 MCP 请求
2. **依赖注入**: 使用 FastAPI 的依赖注入系统管理数据库会话和 MCP 客户端
3. **类型提示**: 使用 Pydantic 模型进行请求和响应验证
4. **流式响应**: 实现流式聊天响应
5. **数据库集成**: 使用 SQLAlchemy ORM
6. **MCP 客户端实现**: 集成标准化的 MCP 客户端接口

### FastAPI 版本运行

```bash
cd fastapi/
pip install -r requirements.txt

# 初始化数据库
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head

# 启动服务
uvicorn app.main:app --reload
```

API 文档将在以下地址可用:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 💡 未来规划 (RoadMap)

### UI界面
- [ ] 手机应用界面
- [ ] 多模态交互
- [ ] 表单输入

### 后端
- [ ] DFS工作流拓扑
- [ ] RAG系统集成
- [ ] MCP协议扩展支持
- [ ] 多校园系统集成

### MCP 相关
- [ ] 校园定制 MCP 服务器开发
- [ ] 多源数据融合与处理
- [ ] 实时数据推送机制
- [ ] 权限与安全控制模块

## 📞 联系方式

如果您对该项目感兴趣或有任何疑问，可以通过[邮箱](mailto:3092492683@qq.com)联系我。
