"use client";

import { useState, useRef, useEffect } from "react";
import ChatWindowShadcn from "./ChatWindowShadcn";
// 移除 ResizableBox 导入
// import { ResizableBox } from "react-resizable";
// import "react-resizable/css/styles.css";
import { Infinity } from "lucide-react";
import ProtectedLayout from "../../components/ProtectedLayout";

// 定义Agent数据类型
interface AgentData {
  id: string;
  type:
    | "table"
    | "form"
    | "image"
    | "code"
    | "text"
    | "chart"
    | "file"
    | "markdown";
  title?: string;
  content: any;
  timestamp: string;
}

export default function ChatPage() {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [leftWidth, setLeftWidth] = useState(600);
  const [agentData, setAgentData] = useState<AgentData[]>([]);

  // 添加拖拽相关状态
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  useEffect(() => {
    addAllSampleData();
  }, []);

  // 处理鼠标按下事件
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;
    e.preventDefault();
  };

  // 处理鼠标移动事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartX.current;
      const newWidth = Math.max(
        400, // 最小宽度
        Math.min(800, dragStartWidth.current + deltaX) // 最大宽度
      );
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, leftWidth]);

  // 模拟接收Agent数据的函数
  const handleAgentDataReceived = (data: AgentData) => {
    setAgentData((prev) => [...prev, data]);
  };

  // 通用的JSON数据解析函数
  const parseAndAddData = (jsonString: string) => {
    try {
      const parsedData = JSON.parse(jsonString);
      const agentData: AgentData = {
        id: parsedData.id || Date.now().toString(),
        type: parsedData.type,
        title: parsedData.title,
        content: parsedData.content,
        timestamp: parsedData.timestamp || new Date().toISOString(),
      };
      handleAgentDataReceived(agentData);
    } catch (error) {
      console.error('JSON解析失败:', error);
    }
  };

  // 添加表格数据示例
  const addTableData = () => {
    const jsonData = JSON.stringify({
      type: "table",
      title: "用户数据表",
      content: {
        headers: ["姓名", "年龄", "职业", "城市", "薪资"],
        rows: [
          ["张三", "25", "前端工程师", "北京", "15000"],
          ["李四", "30", "UI设计师", "上海", "12000"],
          ["王五", "28", "产品经理", "深圳", "18000"],
          ["赵六", "32", "后端工程师", "杭州", "16000"],
        ],
      },
    });
    parseAndAddData(jsonData);
  };

  // 添加表单数据示例
  const addFormData = () => {
    const jsonData = JSON.stringify({
      type: "form",
      title: "用户信息表单",
      content: {
        fields: [
          { label: "用户名", value: "john_doe" },
          { label: "邮箱", value: "john@example.com" },
          { label: "电话", value: "+86 138-0013-8000" },
          { label: "地址", value: "北京市朝阳区某某街道123号" },
          { label: "注册时间", value: "2024-01-15 10:30:00" },
        ],
      },
    });
    parseAndAddData(jsonData);
  };

  // 添加代码数据示例
  const addCodeData = () => {
    const jsonData = JSON.stringify({
      type: "code",
      title: "React组件代码",
      content: {
        code: `function Welcome({ name }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log('Component mounted');
  }, []);
  
  return (
    <div className="welcome">
      <h1>Hello, {name}!</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}`,
      },
    });
    parseAndAddData(jsonData);
  };

  // 添加文本数据示例
  const addTextData = () => {
    const jsonData = JSON.stringify({
      type: "text",
      title: "分析报告",
      content: {
        text: `数据分析结果摘要：

本次分析共处理了1000条用户数据，发现以下关键趋势：

1. 用户活跃度在工作日明显高于周末
2. 移动端访问占比达到78%
3. 用户平均停留时间为3.5分钟
4. 转化率相比上月提升了12%

建议：
- 加强移动端用户体验优化
- 在用户活跃时段增加推送频率
- 优化页面加载速度以提升用户体验`,
      },
    });
    parseAndAddData(jsonData);
  };

  // 添加图片数据示例
  const addImageData = () => {
    const jsonData = JSON.stringify({
      type: "image",
      title: "生成的图表",
      content: {
        url: "https://www.zafu.edu.cn/__local/B/7A/CD/14F9B34BFBC2F92E51A93D05408_BF2CDB39_11C36.jpg",
        alt: "示例图表",
      },
    });
    parseAndAddData(jsonData);
  };

  // 添加图表数据示例
  const addChartData = () => {
    const jsonData = JSON.stringify({
      type: "chart",
      title: "销售数据图表",
      content: {
        chartType: "柱状图",
        data: {
          labels: ["1月", "2月", "3月", "4月", "5月"],
          values: [120, 190, 300, 500, 200],
          title: "月度销售额（万元）",
        },
      },
    });
    parseAndAddData(jsonData);
  };

  // 添加文件数据示例
  const addFileData = () => {
    const jsonData = JSON.stringify({
      type: "file",
      title: "生成的报告文件",
      content: {
        name: "monthly_report.pdf",
        type: "PDF",
        size: "2.3 MB",
        url: "#",
      },
    });
    parseAndAddData(jsonData);
  };

  // 添加Markdown数据示例
  const addMarkdownData = () => {
    const jsonData = JSON.stringify({
      type: "markdown",
      title: "项目文档",
      content: {
        markdown: `# 项目概述

这是一个基于React和Next.js的现代化Web应用程序。

## 主要功能

- **聊天系统**: 支持实时对话和历史记录
- **工作台**: 动态展示各种数据类型
- **响应式布局**: 适配不同屏幕尺寸

## 技术栈

- Frontend: React, Next.js, TypeScript
- UI: Tailwind CSS, shadcn/ui
- Backend: Django/FastAPI

## 安装说明

\`\`\`bash
npm install
npm run dev
\`\`\`

> **注意**: 请确保Node.js版本 >= 18.0.0`,
      },
    });
    parseAndAddData(jsonData);
  };

  // 添加所有类型的示例数据
  const addAllSampleData = () => {
    setTimeout(() => addTableData(), 100);
    setTimeout(() => addFormData(), 200);
    setTimeout(() => addCodeData(), 300);
    setTimeout(() => addTextData(), 400);
    setTimeout(() => addImageData(), 500);
    setTimeout(() => addChartData(), 600);
    setTimeout(() => addFileData(), 700);
    setTimeout(() => addMarkdownData(), 800);
  };

  // 清空所有数据
  const clearAllData = () => {
    setAgentData([]);
  };

  return (
    <ProtectedLayout>
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex relative">
          {/* 左侧聊天窗口 */}
          <div className="relative" style={{ width: leftWidth, height: "100vh" }}>
            <div className="h-full">
              <ChatWindowShadcn
                sessionId={activeSessionId}
                onSessionChange={setActiveSessionId}
              />
            </div>

            {/* 拖拽区域 */}
            <div
              className={`absolute top-0 right-0 w-0.5 h-full cursor-col-resize transition-all duration-200 ${
                isHovering || isDragging ? "bg-blue-400" : "bg-transparent"
              }`}
              style={{
                height: "calc(100% - 35px)", // 上下各留4px
                top: "50%",
                transform: "translateY(-50%)", // 减去上下 4px
              }}
              onMouseDown={handleMouseDown}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              title="拖拽调整窗口大小"
            />
          </div>
        </main>
      </div>
    </ProtectedLayout>
  );
}
