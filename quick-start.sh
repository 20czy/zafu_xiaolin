#!/bin/bash
# quick-start.sh - 快速启动脚本

echo "🚀 快速启动多服务应用..."

# 创建必要的目录
echo "📁 创建目录..."
mkdir -p logs media

# 启动服务
echo "🔨 构建并启动服务..."
docker-compose up --build -d

echo "⏳ 等待服务启动（30秒）..."
sleep 30

echo "🔍 检查服务状态..."
docker-compose ps

echo ""
echo "✅ 快速启动完成！"
echo "📱 前端: http://localhost:3000"
echo "🔧 Django: http://localhost:8000" 
echo "⚡ FastAPI: http://localhost:8001"
echo ""
echo "📊 查看日志: docker-compose logs -f"
echo "🛑 停止服务: docker-compose down"