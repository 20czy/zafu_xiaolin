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
      <main className="flex-1 flex">
        <div className="flex-1 flex items-start justify-center gap-8 p-8">
          <div className="w-1/2 p-4 border-r">
            <FileUploader side="left" />
          </div>
          <div className="w-1/2 p-4">
            <FileUploader side="right" />
          </div>
        </div>
        
        <ChatWindowShadcn
          isExpanded={isChatExpanded}
          onToggle={() => setIsChatExpanded(!isChatExpanded)}
          sessionId={activeSessionId}
          onSessionChange={setActiveSessionId}
        />
      </main>
    </div>
  );
}
