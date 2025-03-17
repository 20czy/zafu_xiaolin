"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import "react-resizable/css/styles.css";
import SessionHistory from "./AIChatWindow/SessionHistory";
import MessageList from "./AIChatWindow/MessageList";
import ChatInput from "./AIChatWindow/ChatInput";
import { fetchWithCSRF, useCSRFToken } from "./util";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

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
    Array<{ text: string; isUser: boolean }>
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

            const documentsData = await fetchWithCSRF(
              `http://localhost:8000/api/chat/sessions/${session.id}/documents/`
            );

            const messagesData = await fetchWithCSRF(
              `http://localhost:8000/api/chat/sessions/${session.id}/messages/`
            );

            if (
              messagesData.status === "success" &&
              messagesData.data.length === 0 &&
              documentsData.status === "success" &&
              documentsData.data.length === 0
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

  const handleSend = async () => {
    if (!input.trim() || !sessionId) return;

    const currentMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { text: currentMessage, isUser: true }]);
    setIsStreaming(true);
    setStreamingMessage(""); // 重置流式消息

    let accumulatedMessage = "";

    try {
      const response = await fetch("http://localhost:8000/api/chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: currentMessage,
          session_id: sessionId,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法获取响应流");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(5));
              accumulatedMessage += data.content;
              // 更新流式消息状态以实现打字机效果
              setStreamingMessage(accumulatedMessage);
            } catch (e) {
              console.error("解析SSE数据失败:", e);
            }
          }
        }
      }

      // 流式接收完成，更新消息列表
      setMessages((prev) => [
        ...prev,
        { text: accumulatedMessage, isUser: false },
      ]);
      setStreamingMessage(""); // 清空流式消息
      setIsStreaming(false);
    } catch (error) {
      console.error("发送消息失败:", error);
      setMessages((prev) => [
        ...prev,
        { text: "网络错误，请检查连接后重试。", isUser: false },
      ]);
      setStreamingMessage("");
      setIsStreaming(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchWithCSRF(
        `http://localhost:8000/api/chat/sessions/${sessionId}/messages/`
      )
        .then((data) => {
          if (data.status === "success") {
            const newMessages = data.data.map(
              (msg: { content: string; is_user: boolean }) => ({
                text: msg.content,
                isUser: msg.is_user,
              })
            );
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

  // 修改 return 部分
  return (
    <div className="h-screen w-full flex p-4">
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-[200px] w-full"
      >
        <ResizablePanel defaultSize={20} minSize={15} maxSize={80}>
          <Card className="h-full flex flex-col">
            <CardHeader className="p-4 flex flex-row justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">ZAFUgpt</h2>
                <Avatar className="pl-0">
                  <AvatarImage
                    src="https://www.zafu.edu.cn/__local/E/17/4D/EADA754B779AD05D115132A676B_4504F299_11407.jpg"
                    alt="@shadcn"
                  />
                  <AvatarFallback>CN</AvatarFallback>
                </Avatar>
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

            <CardContent className="p-0 flex-1 overflow-auto">
              <MessageList
                messages={messages}
                streamingMessage={isStreaming ? streamingMessage : null}
              />
            </CardContent>

            <CardFooter className="pl-4 pr-4 pt-4">
              
              <ChatInput
                input={input}
                setInput={setInput}
                handleSend={handleSend}
              />
              
            </CardFooter>
          </Card>
        </ResizablePanel>
        <ResizableHandle className="bg-transparent border-none" />
        <ResizablePanel defaultSize={80}>
          <div className="h-full p-6">{/* 这里可以放置其他内容 */}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
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
