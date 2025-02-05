"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Send, Plus, History } from "lucide-react";
import { ResizableBox } from "react-resizable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import "react-resizable/css/styles.css";

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

  // 添加初始化会话的useEffect
  useEffect(() => {
    const createInitialSession = async () => {
      if (!sessionId) {
        try {
          const response = await fetch(
            "http://localhost:8000/api/chat/sessions/",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
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
      fetch(`http://localhost:8000/api/chat/sessions/${sessionId}/messages/`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "success") {
            const newMessages = data.data.map((msg: { content: string; is_user: boolean }) => ({
              text: msg.content,
              isUser: msg.is_user,
            }));
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
      const response = await fetch("http://localhost:8000/api/chat/sessions/");
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
      const response = await fetch('http://localhost:8000/api/chat/sessions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      if (data.status === 'success') {
        onSessionChange(data.data.id);
        setMessages([]); // 清空当前消息
        fetchSessions(); // 更新会话列表
      } else {
        console.error('创建新会话失败:', data.message);
      }
    } catch (error) {
      console.error('创建新会话失败:', error);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-screen flex">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="self-center h-12 w-12 rounded-l-md rounded-r-none border bg-background"
      >
        {isExpanded ? <ChevronRight /> : <ChevronLeft />}
      </Button>

      <AnimatePresence>
        {isExpanded && (
          <ResizableBox
            width={width}
            height={window.innerHeight}
            minConstraints={[300, window.innerHeight]}
            maxConstraints={[600, window.innerHeight]}
            resizeHandles={["w"]}
            axis="x"
            onResize={(e, { size }) => {
              setWidth(size.width);
            }}
          >
            <Card className="h-full border-l-0 rounded-l-none">
              <CardHeader className="p-4 flex flex-row justify-between items-center">
                <h2 className="font-semibold">AI 助手</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={handleNewSession}>
                    <Plus className="h-4 w-4" />
                  </Button>

                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          console.log("fetchSessions");
                          fetchSessions();
                        }}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px]">
                      <SheetHeader>
                        <SheetTitle>聊天历史</SheetTitle>
                      </SheetHeader>
                      <ScrollArea className="h-full">
                        <div className="space-y-2 py-4">
                          {sessions.map((session) => (
                            <Button
                              key={session.id}
                              variant={
                                sessionId === session.id ? "secondary" : "ghost"
                              }
                              className="w-full justify-start"
                              onClick={() => {
                                if (onSessionChange) {
                                  onSessionChange(session.id);
                                }
                              }}
                            >
                              {session.title}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {new Date(
                                  session.updated_at
                                ).toLocaleDateString()}
                              </span>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </SheetContent>
                  </Sheet>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-8rem)] px-4">
                  <div className="flex flex-col gap-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          message.isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.isUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>

              <CardFooter className="p-4">
                <div className="flex w-full gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSend()}
                    placeholder="输入消息..."
                    className="flex-1"
                  />
                  <Button size="icon" onClick={handleSend}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </ResizableBox>
        )}
      </AnimatePresence>
    </div>
  );
}
