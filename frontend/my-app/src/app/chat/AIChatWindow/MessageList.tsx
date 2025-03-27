// MessageList.tsx
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageItem from "./MessageItem";
import ProcessingInfo from "./ProcessingInfo";
import { useRef, useEffect } from "react";

interface MessageListProps {
  messages: Array<{ text: string; isUser: boolean }>;
  streamingMessage: string | null;
  processingSteps: string[]; // 任务的处理的步骤，包括：1. 生成任务计划 2. 选择工具 
  taskPlan: any[]; // 任务计划详情
  toolSelections: Record<string, any>; // 工具选择详情
  taskResults: Record<string, any>; // 任务结果详情
  isProcessing: boolean; // 是否正在处理
}

export default function MessageList({
  messages,
  streamingMessage,
  processingSteps,
  taskPlan,
  toolSelections,
  taskResults,
  isProcessing,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessage, processingSteps]);
  
  const processingInfo = {
    processingSteps,
    taskPlan,
    toolSelections,
    taskResults,
    isProcessing
  };
  
  return (
    <ScrollArea className="h-full px-4" ref={scrollRef}>
      <div className="flex flex-col gap-4 py-4">
        {messages.map((message, index) => (
          <MessageItem 
            key={index}
            text={message.text}
            isUser={message.isUser}
          />
        ))}
        
        {isProcessing && (
          <>
            {processingSteps.length > 0 && (
              <ProcessingInfo {...processingInfo} />
            )}
            {streamingMessage && (
              <MessageItem 
                text={streamingMessage}
                isUser={false}
              />
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
