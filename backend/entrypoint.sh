#!/bin/bash
set -e

# 等待数据库启动
echo "等待数据库启动..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 1
done
echo "数据库已启动"

# 运行迁移
python manage.py migrate

# 收集静态文件
python manage.py collectstatic --noinput

# 启动Django
python manage.py runserver 0.0.0.0:8000