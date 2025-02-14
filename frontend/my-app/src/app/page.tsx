"use client";

import { useState } from "react";
import ChatWindowShadcn from './components/ChatWindowShadcn'
import FileUploader from "./components/FileUploader";
import Navbar from "./components/Navbar";

export default function Home() {
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 flex relative"> {/* 添加 relative 定位 */}
        {/* 文件上传区域 */}
        <div className="flex-1 flex items-start justify-center gap-8 p-8">
          <div className="w-1/2 p-4 border-r">
            <FileUploader side="left" sessionId={activeSessionId} />
          </div>
          <div className="w-1/2 p-4">
            <FileUploader side="right" sessionId={activeSessionId} />
          </div>
        </div>
        
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
