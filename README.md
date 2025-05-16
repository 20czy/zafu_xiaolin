<p align="center">
    <img alt="xiaolin" width="200" style="border-radius: 10px;" src="https://github.com/user-attachments/assets/2cb3cc13-fce5-4312-909c-fa93129685ca">
</p>

## 农林小林xiaolin

农林小林是面向校园和教育场景使用的全栈校园agent解决方案框架。

灵感来源于
paper: [HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in HuggingFace](http://arxiv.org/abs/2303.17580), Yongliang Shen, Kaitao Song, Xu Tan, Dongsheng Li, Weiming Lu and Yueting Zhuang (the first two authors contribute equally)

使用自然语言作为LLM沟通的媒介，集成任务规划✍️和工具调用🔧为一体，专注于对接现有的校园系统，善于解决校园范围内复杂问题🤔。

### 🦾项目演示：

https://github.com/user-attachments/assets/89f6fd26-3d2b-4d25-a6b3-afe34c89fa88

## 💼工作流展示

<img width="656" alt="截屏2025-03-13 16 59 54" src="https://github.com/user-attachments/assets/f92bcfdc-c4b7-4709-9a77-466c5107609f" />

## 💻运行本项目
1. 运行redis
运行本项目前要先保证在本地6379端口运行redis服务，windows用户可以选择使用docker来运行

`docker pull redis`

`docker run -d -p 6379:6379 --name my_redis redis`

2. 启动后端
在项目的根目录下运行命令

`pip install -r requirements.txt`

安装python的环境依赖

`cd .\backend\`

`python manage.py runserver`

启动后端服务

3. 启动前端服务

安装前端项目环境依赖

`cd .\frontend\`

`npm install package.json`

运行启动命令

`npm run dev`

4. 更改环境变量配置

修改`.\backend\chatbot\.env`文件DEEPSEEK_API_KEY,修改为自己的api-key

5. 在浏览器访问localhost:3000/login登录

默认账号密码为root/123456

6. 访问localhost:3000/chat开启聊天测试

## 💡 RoadMap

`1` UI界面
   - [ ] 手机应用界面
   - [ ] 多模态交互
   - [ ] 表单输入
 

`2` 后端
   - [ ] dfs工作流拓扑
   - [ ] rag系统集成

## 联系我

如果您对该项目感兴趣或有任何疑问可通过[邮箱](mailto:3092492683@qq.com)联系我
