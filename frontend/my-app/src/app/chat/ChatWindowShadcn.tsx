"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SessionHistory from "./AIChatWindow/SessionHistory";
import MessageList from "./AIChatWindow/MessageList";
import ChatInput from "./AIChatWindow/ChatInput";
import { fetchWithCSRF, useCSRFToken } from "./util";

interface ChatWindowProps {
  sessionId: number | null;
  onSessionChange: (sessionId: number | null) => void;
}

export default function ChatWindowShadcn({
  sessionId,
  onSessionChange,
}: ChatWindowProps) {
  // 删除 width 状态
  const [messages, setMessages] = useState<
    Array<{
      text: string;
      isUser: boolean;
      processInfo?: {
        steps: string[];
        taskPlan: any;
        toolSelections: any;
        taskResults: any;
      };
    }>
  >([]);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<
    Array<{ id: number; title: string; updated_at: string }>
  >([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // 使用 useRef 来标记会话是否已创建
  const isSessionCreating = useRef(false);

  // 添加初始化会话的useEffect
  // 添加一个 ref 来追踪最近创建的会话
  const recentlyCreatedSessionId = useRef<number | null>(null);

  // 添加isAgent状态
  const [isAgent, setIsAgent] = useState(false);

  // 修改创建初始会话的 useEffect
  useEffect(() => {
    const createInitialSession = async () => {
      if (!sessionId && !isSessionCreating.current) {
        try {
          isSessionCreating.current = true;
          const data = await fetchWithCSRF(
            "http://localhost:8000/api/chat/sessions/",
            {
              method: "POST",
            }
          );

          if (data.status === "success") {
            recentlyCreatedSessionId.current = data.data.id; // 记录新创建的会话 ID
            onSessionChange(data.data.id);
          }
        } catch (error) {
          console.error("创建初始会话失败:", error);
        } finally {
          isSessionCreating.current = false;
        }
      }
    };

    createInitialSession();
  }, [sessionId, onSessionChange]);

  // 修改清理空会话的 useEffect
  useEffect(() => {
    const cleanEmptySessions = async () => {
      try {
        const sessionsData = await fetchWithCSRF(
          "http://localhost:8000/api/chat/sessions/"
        );
        if (sessionsData.status === "success") {
          for (const session of sessionsData.data) {
            // 跳过最近创建的会话
            if (session.id === recentlyCreatedSessionId.current) {
              continue;
            }

            const messagesData = await fetchWithCSRF(
              `http://localhost:8000/api/chat/sessions/${session.id}/messages/`
            );

            if (
              messagesData.status === "success" &&
              messagesData.data.length === 0
            ) {
              await fetchWithCSRF(
                `http://localhost:8000/api/chat/sessions/${session.id}/messages/`,
                {
                  method: "DELETE",
                }
              );

              if (session.id === sessionId) {
                onSessionChange(null);
              }
            }
          }
          fetchSessions();
        }
      } catch (error) {
        console.error("清理空会话失败:", error);
      }
    };

    // 延迟执行清理，给初始会话创建留出时间
    const timeoutId = setTimeout(cleanEmptySessions, 1000);
    return () => clearTimeout(timeoutId);
  }, []); // 仅在组件首次加载时执行

  // 添加状态来跟踪当前正在流式接收的消息
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // 添加状态来跟踪当前正在处理的信息
  const [currentProcessInfo, setCurrentProcessInfo] = useState<{
    steps: string[];
    taskPlan: any[];
    toolSelections: Record<string, any>;
    taskResults: Record<string, any>;
  } | null>(null);

  // 1. 初始化状态重置
  const resetChatState = (currentMessage: string) => {
    setInput("");
    setMessages((prev) => [...prev, { text: currentMessage, isUser: true }]);
    setIsStreaming(true);
    setStreamingMessage("");

    setCurrentProcessInfo({
      steps: [],
      taskPlan: [],
      toolSelections: {},
      taskResults: {},
    });
  };

  // 2. 处理SSE数据行
  const processSSELine = (
    line: string,
    accumulatedMessage: { current: string },
    processInfo: {
      steps: string[];
      taskPlan: any;
      toolSelections: any;
      taskResults: any;
    }
  ) => {
    if (line.startsWith("data: ")) {
      try {
        const data = JSON.parse(line.slice(5));

        if (data.type === "step") {
          processInfo.steps = [...processInfo.steps, data.content];
          setCurrentProcessInfo((prevInfo) => ({
            ...prevInfo!,
            steps: [...processInfo.steps],
          }));
        } else if (data.type === "data") {
          if (data.subtype === "task_plan") {
            processInfo.taskPlan = data.content;
            setCurrentProcessInfo((prevInfo) => ({
              ...prevInfo!,
              taskPlan: data.content,
            }));
          } else if (data.subtype === "tool_selection") {
            processInfo.toolSelections = data.content;
            setCurrentProcessInfo((prevInfo) => ({
              ...prevInfo!,
              toolSelections: data.content,
            }));
          } else if (data.subtype === "task_result") {
            processInfo.taskResults = {
              ...processInfo.taskResults,
              [data.content.task_id]: data.content.result,
            };
            setCurrentProcessInfo((prevInfo) => ({
              ...prevInfo!,
              taskResults: {
                ...prevInfo!.taskResults,
                [data.content.task_id]: data.content.result,
              },
            }));
          }
        } else {
          accumulatedMessage.current += data.content || "";
          setStreamingMessage(accumulatedMessage.current);
        }
      } catch (e) {
        console.error("解析SSE数据失败:", e);
      }
    }
  };

  // 3. 处理流式响应
  const handleStreamResponse = async (
    reader: ReadableStreamDefaultReader<Uint8Array>
  ) => {
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulatedMessage = { current: "" };
    let processInfo = {
      steps: [] as string[],
      taskPlan: null as any,
      toolSelections: null as any,
      taskResults: null as any,
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        processSSELine(line, accumulatedMessage, processInfo);
      }
    }

    return {
      message: accumulatedMessage.current,
      processInfo,
    };
  };

  // 4. 发送网络请求
  const sendChatRequest = async (message: string, sessionId: number, isAgent: boolean) => {
    const response = await fetchWithCSRF("http://localhost:8001/api/v1/chat/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        session_id: String(sessionId),
        is_agent: isAgent,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("无法获取响应流");

    return reader;
  };

  // 5. 处理错误情况
  const handleChatError = (error: unknown) => {
    console.error("发送消息失败:", error);
    setMessages((prev) => [
      ...prev,
      { text: "网络错误，请检查连接后重试。", isUser: false },
    ]);
  };

  // 6. 清理状态
  const cleanupChatState = () => {
    setStreamingMessage("");
    setCurrentProcessInfo(null);
    setIsStreaming(false);
  };

  // 7. 主函数（保持原有逻辑）
  const handleSend = async () => {
    if (!input.trim() || !sessionId) return;

    const currentMessage = input;

    // 重置状态
    resetChatState(currentMessage);

    try {
      // 发送请求
      const reader = await sendChatRequest(currentMessage, sessionId, isAgent);

      // 处理流式响应
      const result = await handleStreamResponse(reader);

      // 更新最终消息
      setMessages((prev) => [
        ...prev,
        {
          text: result.message,
          isUser: false,
          processInfo: result.processInfo,
        },
      ]);

      cleanupChatState();
    } catch (error) {
      handleChatError(error);
      cleanupChatState();
    }
  };
  // 当 sessionId 改变时，重新获取消息
  useEffect(() => {
    if (sessionId) {
      fetchWithCSRF(
        `http://localhost:8000/api/chat/sessions/${sessionId}/messages/`
      )
        .then((data) => {
          if (data.status === "success") {
            const newMessages = data.data.map((msg: any) => ({
              text: msg.content,
              isUser: msg.is_user,
              processInfo: msg.process_info
                ? {
                    steps: msg.process_info.steps,
                    taskPlan: msg.process_info.task_plan,
                    toolSelection: msg.process_info.tool_selection,
                    taskResults: msg.process_info.task_results,
                  }
                : undefined,
            }));
            setMessages(newMessages);
          }
        })
        .catch((error) => {
          console.error("获取历史消息失败:", error);
        });
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const fetchSessions = async () => {
    try {
      const data = await fetchWithCSRF(
        "http://localhost:8000/api/chat/sessions/"
      );
      if (data.status === "success") {
        setSessions(data.data);
      }
    } catch (error) {
      console.error("获取聊天历史失败:", error);
    }
  };

  const handleNewSession = async () => {
    try {
      const data = await fetchWithCSRF(
        "http://localhost:8000/api/chat/sessions/",
        {
          method: "POST",
        }
      );

      if (data.status === "success") {
        onSessionChange(data.data.id);
        setMessages([]);
        fetchSessions();
      }
    } catch (error) {
      console.error("创建新会话失败:", error);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await fetchWithCSRF(
        `http://localhost:8000/api/chat/sessions/${sessionId}/messages/`,
        {
          method: "DELETE",
        }
      );

      fetchSessions();
      if (sessionId === sessionId) {
        onSessionChange(null);
      }
    } catch (error) {
      console.error("删除会话失败:", error);
    }
  };

  const handleAgentChange = () => {
    setIsAgent(!isAgent);
  };

  return (
    <div className="h-full w-full p-4 pr-1">
      <Card className="h-full flex flex-col">
        <CardHeader className="p-4 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Avatar className="pl-0">
              <AvatarImage
                src="https://i.miji.bid/2025/03/27/b5e12e0800f7490f597879941b6018da.png"
                alt="@shadcn"
              />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <h2 className="font-extrabold text-lg">农林小林</h2>
          </div>

          <HeaderActions
            onNewSession={handleNewSession}
            onOpenHistory={() => {
              fetchSessions();
              setIsHistoryOpen(true);
            }}
          />
        </CardHeader>

        <SessionHistory
          sessions={sessions}
          currentSessionId={sessionId}
          onSessionChange={onSessionChange}
          onDeleteSession={handleDeleteSession}
          open={isHistoryOpen}
          onOpenChange={setIsHistoryOpen}
        />

        <CardContent className="p-0 flex-1 overflow-hidden">
          <MessageList
            messages={messages}
            streamingMessage={isStreaming ? streamingMessage : null}
            currentProcessInfo={currentProcessInfo}
            isProcessing={isStreaming}
          />
        </CardContent>

        <CardFooter className="pl-2 pr-2 pb-3">
          <ChatInput
            input={input}
            setInput={setInput}
            handleSend={handleSend}
            onAgentChange={handleAgentChange}
          />
        </CardFooter>
      </Card>
    </div>
  );
}

// HeaderActions.tsx
import { Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeaderActions = ({
  onNewSession,
  onOpenHistory,
}: {
  onNewSession: () => void;
  onOpenHistory: () => void;
}) => (
  <div className="flex gap-2">
    <Button variant="outline" size="icon" onClick={onNewSession}>
      <Plus className="h-4 w-4" />
    </Button>

    <Button variant="outline" size="icon" onClick={onOpenHistory}>
      <History className="h-4 w-4" />
    </Button>
  </div>
);
