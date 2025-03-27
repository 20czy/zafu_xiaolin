// MessageItem.tsx
import MarkdownRenderer from "./MarkdownRenderer";


interface MessageItemProps {
  text: string;
  isUser: boolean;
}

export default function MessageItem({ text, isUser }: MessageItemProps) {
  
  return (
    <div className={`flex ${isUser ? "justify-end mb-2" : "justify-start mb-3"} flex-col w-full`}>
      
      <div className="flex w-full">
        <div
          className={`max-w-[80%] p-3 rounded-lg ${
            isUser ? "bg-primary text-primary-foreground ml-auto" : ""
          }`}
        >
          {isUser ? text : <MarkdownRenderer content={text} />}
        </div>
      </div>
    </div>
  );
}