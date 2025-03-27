import React, { useRef, useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Upload } from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
  onFileUpload?: (file: File) => void;
  onAgentChange?: () => void;
  currentAgent?: string;
}

const ChatInput = ({ 
  input, 
  setInput, 
  handleSend, 
  onFileUpload, 
  onAgentChange,
  currentAgent = "🤖 agent" 
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAgentButtonActive, setIsAgentButtonActive] = useState(false);

  // 处理文件上传按钮点击
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择变化
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 处理模式切换按钮点击
  const handleAgentButtonClick = () => {
    setIsAgentButtonActive(!isAgentButtonActive);
    
    // 调用原有的onAgentChange函数
    if (onAgentChange) {
      onAgentChange();
    }
    
  };

  // 自动调整文本区域高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200); // 最大高度限制为200px
      textarea.style.height = `${newHeight}px`;
    }
  }, [input]);

  return (
    <div className="relative w-full rounded-lg border-0 border-gray-200 bg-white shadow-sm">
      <Textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息..."
        className="min-h-[60px] max-h-[200px] pl-3.5 pr-14 py-3 resize-none rounded-3xl"
        style={{ paddingBottom: "2.5rem" }}
      />
      
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        {/* 文件上传按钮 */}
        <Button 
          size="icon" 
          variant="outline" 
          className="rounded-full h-10 w-10 ml-1 mb-1" 
          onClick={handleFileButtonClick}
        >
          <Upload className="h-5 w-5" />
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
        </Button>
        
        {/* 模式切换按钮 */}
        <Button 
          variant="outline" 
          className={`rounded-full h-10 px-4 mb-1 font-bold ${
            isAgentButtonActive ? "bg-green-500 hover:bg-green-500 text-white hover:text-white" : ""
          }`}
          onClick={handleAgentButtonClick}
        >
          {currentAgent}
        </Button>
      </div>
      
      {/* 发送按钮 */}
      <Button 
        size="icon" 
        onClick={handleSend} 
        className="absolute bottom-2 right-2 bg-green-500 rounded-full h-10 w-10 mb-1 mr-1.5"
      >
        <Send className="h-4 w-4 text-white" />
      </Button>
    </div>
  );
};

export default ChatInput;