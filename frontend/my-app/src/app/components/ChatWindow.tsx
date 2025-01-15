"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";

interface ChatWindowProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export default function ChatWindow({ isExpanded, onToggle }: ChatWindowProps) {
  const [messages, setMessages] = useState<
    Array<{ text: string; isUser: boolean }>
  >([]);
  const [input, setInput] = useState("");

  const handleSend = async () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { text: input, isUser: true }]);

    // 这里添加与 AI 模型通信的逻辑
    // const response = await yourAIModelAPI(input)
    // setMessages(prev => [...prev, { text: response, isUser: false }])

    setInput("");
  };

  return (
    <div className="fixed right-0 top-0 h-screen flex">
      <button
        onClick={onToggle}
        className="self-center bg-gray-200 p-2 rounded-l-md"
      >
        {isExpanded ? <ChevronRight /> : <ChevronLeft />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 400 }}
            exit={{ width: 0 }}
            className="bg-white h-full shadow-lg flex flex-col"
          >
            <div className="p-4 bg-gray-100 border-b">
              <h2 className="font-semibold">AI 助手</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.isUser
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="输入消息..."
                  className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSend}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
