"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ResizableBox } from "react-resizable";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import "react-resizable/css/styles.css";
import SessionHistory from "./AIChatWindow/SessionHistory";
import MessageList from "./AIChatWindow/MessageList";
import ChatInput from "./AIChatWindow/ChatInput";
import { fetchCSRFToken } from "./util";

interface ChatWindowProps {
  isExpanded: boolean;
  onToggle: () => void;
  sessionId: number | null;
  onSessionChange: (sessionId: number | null) => void;
}

export default function ChatWindowShadcn({
  isExpanded,
  onToggle,
  sessionId,
  onSessionChange,
}: ChatWindowProps) {
  const [width, setWidth] = useState(400);
  const [messages, setMessages] = useState<
    Array<{ text: string; isUser: boolean }>
  >([]);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<
    Array<{ id: number; title: string; updated_at: string }>
  >([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // 添加初始化会话的useEffect
  useEffect(() => {
    const createInitialSession = async () => {
      if (!sessionId) {
        try {
          const csrfToken = await fetchCSRFToken();

          const response = await fetch(
            "http://localhost:8000/api/chat/sessions/",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrfToken,
              },
              credentials:
                "include", // 添加凭证支持
            }
          );
          const data = await response.json();
          if (data.status === "success") {
            onSessionChange(data.data.id);
          } else {
            console.error("创建初始会话失败:", data.message);
          }
        } catch (error) {
          console.error("创建初始会话失败:", error);
        }
      }
    };

    createInitialSession();
  }, []); // 仅在组件首次加载时执行

  // 简化后的handleSend函数
  const handleSend = async () => {
    if (!input.trim()) return;

    const currentMessage = input;
    setInput(""); // 清空输入框

    // 立即添加用户消息到界面
    setMessages((prevMessages) => [
      ...prevMessages,
      { text: currentMessage, isUser: true },
    ]);

    try {
      const response = await fetch("http://localhost:8000/api/chat/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          message: currentMessage,
          session_id: sessionId,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setMessages((prevMessages) => [
          ...prevMessages,
          { text: data.data.content, isUser: false },
        ]);
      } else {
        setMessages((prevMessages) => [
          ...prevMessages,
          { text: "抱歉，发生了错误，请稍后重试。", isUser: false },
        ]);
      }
    } catch (error) {
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: "网络错误，请检查连接后重试。", isUser: false },
      ]);
      console.error("发送消息失败:", error);
    }
  };

  // 当用户改变会话时，更新历史消息
  useEffect(() => {
    if (sessionId) {
      fetch(`http://localhost:8000/api/chat/sessions/${sessionId}/messages/`, {
        credentials: "include",
      })
        .then((res) => res.json())
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
      // 如果sessionId为null，则清空messages
      setMessages([]);
    }
  }, [sessionId]); // 只在sessionId变化时获取历史消息

  // 获取聊天历史
  const fetchSessions = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/chat/sessions/", {
        credentials: "include",
      });
      const data = await response.json();
      if (data.status === "success") {
        setSessions(data.data);
      }
    } catch (error) {
      console.error("获取聊天历史失败:", error);
    }
  };

  // 添加新建会话的函数
  const handleNewSession = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/chat/sessions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      const data = await response.json();
      if (data.status === "success") {
        onSessionChange(data.data.id);
        setMessages([]); // 清空当前消息
        fetchSessions(); // 更新会话列表
      } else {
        console.error("创建新会话失败:", data.message);
      }
    } catch (error) {
      console.error("创建新会话失败:", error);
    }
  };

  // 添加删除会话的函数
  const handleDeleteSession = async (sessionId: number) => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/chat/sessions/${sessionId}/messages/`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (response.ok) {
        fetchSessions();
        if (sessionId === sessionId) {
          onSessionChange(null);
        }
      } else {
        console.error("删除会话失败");
      }
    } catch (error) {
      console.error("删除会话失败:", error);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-screen flex">
      <ToggleButton onToggle={onToggle} isExpanded={isExpanded} />
      
      <AnimatePresence>
        {isExpanded && (
          <ResizableBox
            width={width}
            height={window.innerHeight}
            minConstraints={[300, window.innerHeight]}
            maxConstraints={[600, window.innerHeight]}
            resizeHandles={["w"]}
            axis="x"
            onResize={(e, { size }) => setWidth(size.width)}
          >
            <Card className="h-full border-l-0 rounded-l-none">
              <CardHeader className="p-4 flex flex-row justify-between items-center">
                <h2 className="font-semibold">AI 审阅助手</h2>
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

              <CardContent className="p-0">
                <MessageList messages={messages} />
              </CardContent>

              <CardFooter className="p-4">
                <ChatInput 
                  input={input}
                  setInput={setInput}
                  handleSend={handleSend}
                />
              </CardFooter>
            </Card>
          </ResizableBox>
        )}
      </AnimatePresence>
    </div>
  );
}

// ToggleButton.tsx
const ToggleButton = ({ onToggle, isExpanded }: { 
  onToggle: () => void;
  isExpanded: boolean;
}) => (
  <Button
    variant="ghost"
    size="icon"
    onClick={onToggle}
    className="self-center h-12 w-12 rounded-l-md rounded-r-none border bg-background"
  >
    {isExpanded ? <ChevronRight /> : <ChevronLeft />}
  </Button>
);

// HeaderActions.tsx
import { Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeaderActions = ({ 
  onNewSession,
  onOpenHistory
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