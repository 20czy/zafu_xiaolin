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
import { fetchWithCSRF, useCSRFToken } from "./util";

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
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([]);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<Array<{ id: number; title: string; updated_at: string }>>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // 添加初始化会话的useEffect
  useEffect(() => {
    const createInitialSession = async () => {
      if (!sessionId) {
        try {
          const data = await fetchWithCSRF("http://localhost:8000/api/chat/sessions/", {
            method: "POST",
          });
          
          if (data.status === "success") {
            onSessionChange(data.data.id);
          }
        } catch (error) {
          console.error("创建初始会话失败:", error);
        }
      }
    };

    createInitialSession();
  }, [sessionId]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const currentMessage = input;
    setInput("");
    setMessages(prev => [...prev, { text: currentMessage, isUser: true }]);

    try {
      const data = await fetchWithCSRF("http://localhost:8000/api/chat/", {
        method: "POST",
        body: JSON.stringify({
          message: currentMessage,
          session_id: sessionId,
        }),
      });

      if (data.status === "success") {
        setMessages(prev => [...prev, { text: data.data.content, isUser: false }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { text: "网络错误，请检查连接后重试。", isUser: false }]);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchWithCSRF(`http://localhost:8000/api/chat/sessions/${sessionId}/messages/`)
        .then(data => {
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
        .catch(error => {
          console.error("获取历史消息失败:", error);
        });
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  const fetchSessions = async () => {
    try {
      const data = await fetchWithCSRF("http://localhost:8000/api/chat/sessions/");
      if (data.status === "success") {
        setSessions(data.data);
      }
    } catch (error) {
      console.error("获取聊天历史失败:", error);
    }
  };

  const handleNewSession = async () => {
    try {
      const data = await fetchWithCSRF("http://localhost:8000/api/chat/sessions/", {
        method: "POST",
      });
      
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
      await fetchWithCSRF(`http://localhost:8000/api/chat/sessions/${sessionId}/messages/`, {
        method: "DELETE",
      });
      
      fetchSessions();
      if (sessionId === sessionId) {
        onSessionChange(null);
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