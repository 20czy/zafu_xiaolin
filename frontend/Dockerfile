# Dockerfile.nextjs
FROM node:lts

WORKDIR /my-app

# 复制 package.json 和 package-lock.json
COPY my-app/package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY my-app .

# # 构建应用（如果需要）
# RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "run", "dev"]