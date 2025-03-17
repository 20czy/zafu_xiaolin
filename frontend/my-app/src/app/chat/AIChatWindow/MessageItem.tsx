// MessageItem.tsx
import MarkdownRenderer from "./MarkdownRenderer";

interface MessageItemProps {
  text: string;
  isUser: boolean;
}

export default function MessageItem({ text, isUser }: MessageItemProps) {
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] p-3 rounded-lg ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {isUser ? text : <MarkdownRenderer content={text} />}
      </div>
    </div>
  );
}