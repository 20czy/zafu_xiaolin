# ZafuGPT FastAPI 版本

这是浙江农林大学智能校园助手「农林小林」的FastAPI实现版本。

## 项目结构

```
fastapi/
├── app/
│   ├── agent/              # 代理系统组件
│   │   ├── LLMController.py    # LLM控制器
│   │   ├── ResponseGenerator.py # 响应生成器
│   │   ├── TaskExecutor.py     # 任务执行器
│   │   ├── TaskPlanner.py      # 任务规划器
│   │   └── ToolSelector.py     # 工具选择器
│   ├── api/               # API路由
│   │   └── v1/            # API v1版本
│   │       ├── chat.py    # 聊天相关端点
│   │       └── users.py   # 用户相关端点
│   ├── core/              # 核心配置
│   ├── db/                # 数据库相关
│   │   ├── models.py      # 数据库模型
│   │   └── session.py     # 数据库会话
│   ├── schemas/           # Pydantic模型
│   │   └── chat.py        # 聊天相关模型
│   ├── services/          # 服务层
│   │   ├── campus_tool_hub.py  # 校园工具集成
│   │   ├── chat_history_manager.py # 聊天历史管理
│   │   └── llm_service.py     # LLM服务
│   └── main.py            # 应用入口
├── alembic/               # 数据库迁移
├── requirements.txt       # 依赖项
└── README.md              # 项目说明
```

## 环境要求

- Python 3.8+
- 所有依赖项都列在 `requirements.txt` 文件中

## 安装

1. 克隆仓库：

```bash
git clone <repository-url>
cd zafugpt/fastapi
```

2. 创建虚拟环境并激活：

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows
```

3. 安装依赖：

```bash
pip install -r requirements.txt
```

4. 设置环境变量：

创建 `.env` 文件并添加以下内容：

```
DEEPSEEK_API_KEY=your_deepseek_api_key
DATABASE_URL=sqlite:///./app.db
```

## 数据库初始化

使用 Alembic 初始化数据库：

```bash
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

## 运行应用

```bash
uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 上运行。

## API 文档

FastAPI 自动生成的 API 文档可在以下地址访问：

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 主要 API 端点

### 聊天

- `POST /api/v1/chat/`: 发送聊天消息并获取响应
- `GET /api/v1/chat/sessions`: 获取所有聊天会话
- `GET /api/v1/chat/sessions/{session_id}/messages`: 获取指定会话的所有消息
- `GET /api/v1/chat/process-info/{session_id}`: 获取指定会话的处理过程信息

## 从 Django 迁移到 FastAPI 的主要变化

1. **异步支持**：FastAPI 原生支持异步编程，所有代理组件和服务都已改为异步方法。

2. **依赖注入**：使用 FastAPI 的依赖注入系统来管理数据库会话和其他依赖项。

3. **类型提示**：使用 Pydantic 模型进行请求和响应验证。

4. **流式响应**：使用 FastAPI 的 StreamingResponse 来实现流式响应。

5. **数据库模型**：保持与 Django 版本相似的数据库模型，但使用 SQLAlchemy ORM。

## 注意事项

- 确保在运行应用前设置了正确的环境变量。
- 对于生产环境，建议使用更安全的数据库配置和适当的 CORS 设置。