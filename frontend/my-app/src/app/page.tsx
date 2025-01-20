"use client";

import { useState } from "react";
import ChatWindowShadcn from './components/ChatWindowShadcn'
import FileUploader from "./components/FileUploader";

export default function Home() {
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  return (
    <main className="min-h-screen flex">
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
      />
    </main>
  );
}
