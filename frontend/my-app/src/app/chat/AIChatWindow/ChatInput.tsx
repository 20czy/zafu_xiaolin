import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  handleSend: () => void;
}

const ChatInput = ({ input, setInput, handleSend }: ChatInputProps) => {
  return (
    <div className="flex w-full gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleSend()}
        placeholder="输入消息..."
        className="flex-1"
      />
      <Button size="icon" onClick={handleSend} className=" bg-green-500">
        <Send className="h-4 w-4 bg-green-500" />
      </Button>
    </div>
  );
};

export default ChatInput;