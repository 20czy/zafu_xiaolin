// MessageList.tsx
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageItem from "./MessageItem";

interface MessageListProps {
  messages: Array<{ text: string; isUser: boolean }>;
  streamingMessage: string | null;
}

export default function MessageList({ messages, streamingMessage }: MessageListProps) {
  return (
    <ScrollArea className="h-[calc(100vh-8rem)] px-4">
      <div className="flex flex-col gap-4">
        {messages.map((message, index) => (
          <MessageItem 
            key={index}
            text={message.text}
            isUser={message.isUser}
          />
        ))}
        {streamingMessage && (
          <MessageItem 
            text={streamingMessage}
            isUser={false}
          />
        )}
      </div>
    </ScrollArea>
  );
}