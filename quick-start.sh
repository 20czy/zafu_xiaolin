#!/bin/bash
# quick-start.sh - 快速启动脚本

echo "🚀 快速启动 demo..."

# 创建必要的目录
echo "📁 创建目录..."
mkdir -p logs media

if [ ! -f fastapi/.env ]; then
  echo "⚙️  未检测到 fastapi/.env"
  echo "   请在 fastapi/.env 中配置 DEEPSEEK_API_KEY 后重启 API 服务，以启用真实模型回复。"
fi

# 启动服务
echo "🔨 构建并启动服务..."
docker-compose up --build -d

echo "⏳ 等待服务启动（10秒）..."
sleep 10

echo "🔍 检查服务状态..."
docker-compose ps

echo ""
echo "✅ 快速启动完成！"
echo "📱 前端: http://localhost:3000"
echo "⚡ API: http://localhost:8001"
echo ""
echo "📊 查看日志: docker-compose logs -f"
echo "🛑 停止服务: docker-compose down"
