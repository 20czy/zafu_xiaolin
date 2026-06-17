# 公网 IP 内部试用部署

## 服务器要求

- Linux 云服务器，建议 2 核 4 GB
- 已安装 Docker Engine 与 Docker Compose
- 安全组开放 TCP 80
- 服务器上只对外暴露 80，前端和 API 端口不直接暴露

## 首次部署

1. 将项目放到服务器。
2. 根据 `.env.production.example` 创建 `.env.production`，三个安全变量必须使用不同随机值。
3. 在 `fastapi/.env` 中配置实际使用的模型 API Key。
4. 启动服务：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

5. 检查状态：

```bash
curl http://127.0.0.1/health
docker compose -f docker-compose.prod.yml ps
```

## 创建试用访问码

每位测试者创建一个独立访问码：

```bash
docker compose -f docker-compose.prod.yml exec api \
  python -m app.scripts.create_trial_token \
  --label "测试者姓名" \
  --days 7 \
  --max-calls 50
```

命令只显示一次访问码。数据库只保存哈希，无法找回原访问码。

访问地址：

```text
http://服务器公网IP/login
```

## 更新与备份

更新代码后重新构建：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

SQLite 数据保存在 `xiaolin_data` Docker 卷中。备份前应暂停 API 写入，再复制卷内的 `/data/xiaolin.db`。

## 当前限制

- 公网 IP 使用 HTTP，访问码和聊天内容没有传输加密，只适合短期、低敏感度内部测试。
- 不要在试用环境输入真实个人隐私、学校生产数据或其他敏感信息。
- 后续绑定域名后，应切换 HTTPS，并将 `COOKIE_SECURE` 改为 `true`。
