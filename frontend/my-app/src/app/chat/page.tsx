"use client";

import { useState } from "react";
import ChatWindowShadcn from "./ChatWindowShadcn";

export default function ChatPage() {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  
  return (
    <div className="min-h-screen flex">
      <main className="flex-1 flex relative">
        <ChatWindowShadcn
          sessionId={activeSessionId}
          onSessionChange={setActiveSessionId}
        />
      </main>
    </div>
  );
}