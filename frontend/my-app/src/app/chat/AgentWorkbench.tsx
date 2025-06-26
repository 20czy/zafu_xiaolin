"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// 定义数据类型
type DataType = "table" | "form" | "image" | "code" | "text" | "chart" | "file" | "markdown";

interface AgentData {
  id: string;
  type: DataType;
  title?: string;
  content: any;
  timestamp: string;
}

interface AgentWorkbenchProps {
  data?: AgentData[];
  onDataReceived?: (data: AgentData) => void;
}

export default function AgentWorkbench({ data = [], onDataReceived }: AgentWorkbenchProps) {
  const [workbenchData, setWorkbenchData] = useState<AgentData[]>(data);

  useEffect(() => {
    setWorkbenchData(data);
  }, [data]);

  const renderContent = (item: AgentData) => {
    switch (item.type) {
      case "table":
        return renderTable(item.content);
      case "form":
        return renderForm(item.content);
      case "image":
        return renderImage(item.content);
      case "code":
        return renderCode(item.content);
      case "text":
        return renderText(item.content);
      case "chart":
        return renderChart(item.content);
      case "file":
        return renderFile(item.content);
      case "markdown":
        return renderMarkdown(item.content);
      default:
        return <div className="text-gray-500">未知数据类型</div>;
    }
  };

  const renderTable = (content: any) => {
    if (!content.headers || !content.rows) {
      return <div className="text-red-500">表格数据格式错误</div>;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              {content.headers.map((header: string, index: number) => (
                <th key={index} className="border border-gray-300 px-4 py-2 text-left">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row: any[], rowIndex: number) => (
              <tr key={rowIndex}>
                {row.map((cell: any, cellIndex: number) => (
                  <td key={cellIndex} className="border border-gray-300 px-4 py-2">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderForm = (content: any) => {
    if (!content.fields) {
      return <div className="text-red-500">表单数据格式错误</div>;
    }
    return (
      <div className="space-y-4">
        {content.fields.map((field: any, index: number) => (
          <div key={index} className="flex flex-col space-y-2">
            <label className="font-medium">{field.label}</label>
            <div className="p-2 border rounded bg-gray-50">{field.value}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderImage = (content: any) => {
    return (
      <div className="flex justify-center">
        <img 
          src={content.url || content.src} 
          alt={content.alt || "Agent生成的图片"}
          className="max-w-full h-auto rounded"
        />
      </div>
    );
  };

  const renderCode = (content: any) => {
    return (
      <pre className="bg-gray-900 text-green-400 p-4 rounded overflow-x-auto">
        <code>{content.code || content}</code>
      </pre>
    );
  };

  const renderText = (content: any) => {
    return (
      <div className="whitespace-pre-wrap">
        {content.text || content}
      </div>
    );
  };

  const renderChart = (content: any) => {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-100 rounded">
        <div className="text-center">
          <div className="text-lg font-medium">图表数据</div>
          <div className="text-sm text-gray-500 mt-2">
            类型: {content.chartType || "未指定"}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {JSON.stringify(content, null, 2)}
          </div>
        </div>
      </div>
    );
  };

  const renderFile = (content: any) => {
    return (
      <div className="border rounded p-4">
        <div className="flex items-center space-x-2">
          <div className="font-medium">{content.name || "未命名文件"}</div>
          <Badge variant="outline">{content.type || "unknown"}</Badge>
        </div>
        {content.size && (
          <div className="text-sm text-gray-500 mt-1">
            大小: {content.size}
          </div>
        )}
        {content.url && (
          <a 
            href={content.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline text-sm mt-2 inline-block"
          >
            下载文件
          </a>
        )}
      </div>
    );
  };

  const renderMarkdown = (content: any) => {
    return (
      <div className="prose max-w-none">
        <pre className="whitespace-pre-wrap">{content.markdown || content}</pre>
      </div>
    );
  };

  const getTypeColor = (type: DataType) => {
    const colors = {
      table: "bg-blue-100 text-blue-800",
      form: "bg-green-100 text-green-800",
      image: "bg-purple-100 text-purple-800",
      code: "bg-gray-100 text-gray-800",
      text: "bg-yellow-100 text-yellow-800",
      chart: "bg-red-100 text-red-800",
      file: "bg-indigo-100 text-indigo-800",
      markdown: "bg-pink-100 text-pink-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Agent 工作台</h3>
          <Badge variant="outline">
            {workbenchData.length} 项结果
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4 space-y-4">
            {workbenchData.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="text-lg">暂无数据</div>
                <div className="text-sm mt-2">Agent执行结果将在这里显示</div>
              </div>
            ) : (
              workbenchData.map((item, index) => (
                <div key={item.id || index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Badge className={getTypeColor(item.type)}>
                        {item.type.toUpperCase()}
                      </Badge>
                      {item.title && (
                        <span className="font-medium">{item.title}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <Separator className="mb-3" />
                  <div className="">
                    {renderContent(item)}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}