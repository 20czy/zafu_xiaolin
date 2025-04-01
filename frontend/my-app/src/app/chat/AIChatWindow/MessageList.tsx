import { ScrollArea } from "@/components/ui/scroll-area";
import MessageItem from "./MessageItem";
import ProcessingInfo from "./ProcessingInfo";
import { useRef, useEffect } from "react";

interface MessageListProps {
  messages: Array<{
    text: string;
    isUser: boolean;
    processInfo?: {
      steps: string[];
      taskPlan: any;
      toolSelections: any;
      taskResults: any;
    };
  }>;
  streamingMessage: string | null;
  currentProcessInfo: {
    steps: string[];
    taskPlan: any[];
    toolSelections: Record<string, any>;
    taskResults: Record<string, any>;
  } | null;
  isProcessing: boolean;
}

export default function MessageList({
  messages,
  streamingMessage,
  currentProcessInfo,
  isProcessing,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessage, currentProcessInfo]);
  
  return (
    <ScrollArea className="h-full px-4" ref={scrollRef}>
      <div className="flex flex-col gap-4 py-4">
        {messages.map((message, index) => (
          <div key={index} className="flex flex-col gap-2">
            {message.processInfo && Object.keys(message.processInfo).length > 0 && (
              <ProcessingInfo 
                processingSteps={message.processInfo.steps || []}
                taskPlan={message.processInfo.taskPlan || []}
                toolSelections={message.processInfo.toolSelections || {}}
                taskResults={message.processInfo.taskResults || {}}
                isProcessing={false}
              />
            )}
            <MessageItem 
              text={message.text}
              isUser={message.isUser}
            />
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex flex-col gap-2">
            {/* Show real-time processing info before showing the streaming message */}
            {currentProcessInfo && currentProcessInfo.steps.length > 0 && (
              <ProcessingInfo 
                processingSteps={currentProcessInfo.steps || []}
                taskPlan={currentProcessInfo.taskPlan || []}
                toolSelections={currentProcessInfo.toolSelections || {}}
                taskResults={currentProcessInfo.taskResults || {}}
                isProcessing={true}
              />
            )}
            
            {/* Show streaming message if available */}
            {streamingMessage && (
              <MessageItem 
                text={streamingMessage}
                isUser={false}
              />
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
