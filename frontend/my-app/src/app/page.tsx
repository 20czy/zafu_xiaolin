"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import ChatWindowShadcn from './components/ChatWindowShadcn'
import FileUploader from "./components/FileUploader";

const FileUploadZone = dynamic(() => import("./components/FileUploadZone"), {
  ssr: false,
});

export default function Home() {
  const [leftFile, setLeftFile] = useState<File | null>(null);
  const [rightFile, setRightFile] = useState<File | null>(null);
  const [isChatExpanded, setIsChatExpanded] = useState(true);

  return (
    <main className="min-h-screen flex">
      <motion.div
        className="flex-1 flex items-center justify-center gap-40 p-8"
        animate={{
          width: isChatExpanded ? "calc(100% - 400px)" : "100%",
        }}
        transition={{ duration: 0.3 }}
      >
        <FileUploader side="left" />
        <FileUploader side="right" />
      </motion.div>

      <ChatWindowShadcn
        isExpanded={isChatExpanded}
        onToggle={() => setIsChatExpanded(!isChatExpanded)}
      />
    </main>
  );
}
