"use client";

import { useState } from "react";
import ChatWindowShadcn from './components/ChatWindowShadcn'
import Navbar from "./components/Navbar";

export default function Home() {
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex relative"> {/* 添加 relative 定位 */}
        {/* 聊天窗口 - 添加绝对定位和 z-index */}
        <div className="absolute top-0 right-0 z-50">
          <ChatWindowShadcn
            isExpanded={isChatExpanded}
            onToggle={() => setIsChatExpanded(!isChatExpanded)}
            sessionId={activeSessionId}
            onSessionChange={setActiveSessionId}
          />
        </div>
      </main>
    </div>
  );
}
