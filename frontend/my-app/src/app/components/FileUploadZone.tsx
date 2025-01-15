"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface FileUploadZoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  side: "left" | "right";
}

export default function FileUploadZone({
  onFileSelect,
  selectedFile,
  side,
}: FileUploadZoneProps) {
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-1/3 ${side === "left" ? "mr-4" : "ml-4"}`}>
        <div className="h-64 rounded-lg border-2 border-dashed border-gray-300"></div>
      </div>
    );
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className={`w-1/3 ${side === "left" ? "mr-4" : "ml-4"}`}>
      <motion.div
        className={`
          h-64 rounded-lg border-2 border-dashed
          flex flex-col items-center justify-center
          cursor-pointer transition-colors
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"}
        `}
        animate={{
          scale: isDragging ? 1.02 : 1,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileSelect}
        />

        {selectedFile ? (
          <div className="text-center">
            <p className="text-green-600 font-medium">已选择文件：</p>
            <p className="text-gray-600">{selectedFile.name}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-600">点击或拖拽文件至此处</p>
            <p className="text-gray-400 text-sm mt-2">支持所有文件类型</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
