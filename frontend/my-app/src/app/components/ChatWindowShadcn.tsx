'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import { ResizableBox } from 'react-resizable'
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import 'react-resizable/css/styles.css'

interface ChatWindowProps {
  isExpanded: boolean
  onToggle: () => void
}

export default function ChatWindowShadcn({ isExpanded, onToggle }: ChatWindowProps) {
  const [width, setWidth] = useState(400)
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([])
  const [input, setInput] = useState('')

  const handleSend = async () => {
    if (!input.trim()) return

    setMessages(prev => [...prev, { text: input, isUser: true }])
    
    try {
      const response = await fetch('http://localhost:8000/api/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input
        })
      })

      const data = await response.json()
      console.log(data)
      
      if (data.status === 'success') {
        setMessages(prev => [...prev, { text: data.data.content, isUser: false }])
      } else {
        setMessages(prev => [...prev, { text: '抱歉，发生了错误，请稍后重试。', isUser: false }])
      }
    } catch (error) {
      setMessages(prev => [...prev, { text: '网络错误，请检查连接后重试。', isUser: false }])
    }

    setInput('')
  }

  return (
    <div className="fixed right-0 top-0 h-screen flex">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="self-center h-12 w-12 rounded-l-md rounded-r-none border bg-background"
      >
        {isExpanded ? <ChevronRight /> : <ChevronLeft />}
      </Button>

      <AnimatePresence>
        {isExpanded && (
          <ResizableBox
            width={width}
            height={window.innerHeight}
            minConstraints={[300, window.innerHeight]}
            maxConstraints={[600, window.innerHeight]}
            resizeHandles={['w']}
            axis="x"
            onResize={(e, { size }) => {
              setWidth(size.width)
            }}
          >
            <Card className="h-full border-l-0 rounded-l-none">
              <CardHeader className="p-4">
                <h2 className="font-semibold">AI 助手</h2>
              </CardHeader>

              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-8rem)] px-4">
                  <div className="flex flex-col gap-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.isUser
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {message.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>

              <CardFooter className="p-4">
                <div className="flex w-full gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="输入消息..."
                    className="flex-1"
                  />
                  <Button size="icon" onClick={handleSend}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </ResizableBox>
        )}
      </AnimatePresence>
    </div>
  )
}