# Dockerfile.django
FROM python:3.12-slim

WORKDIR /

# 安装系统依赖
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && \
    apt-get install -y gcc && \
    rm -rf /var/lib/apt/lists/*

# 复制源代码
COPY . .

# 运行数据库迁移
RUN python manage.py migrate

# 收集静态文件
RUN python manage.py collectstatic --noinput

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]