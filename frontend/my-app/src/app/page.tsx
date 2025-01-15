'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import ChatWindow from './components/ChatWindow'

const FileUploadZone = dynamic(() => import('./components/FileUploadZone'), { ssr: false })

export default function Home() {
  const [leftFile, setLeftFile] = useState<File | null>(null)
  const [rightFile, setRightFile] = useState<File | null>(null)
  const [isChatExpanded, setIsChatExpanded] = useState(true)

  return (
    <main className="min-h-screen flex">
      <motion.div 
        className="flex items-center justify-between p-8"
        animate={{ 
          width: isChatExpanded ? 'calc(100% - 400px)' : '100%' 
        }}
        transition={{ duration: 0.3 }}
      >
        <FileUploadZone 
          onFileSelect={setLeftFile}
          selectedFile={leftFile}
          side="left"
        />
        
        <FileUploadZone
          onFileSelect={setRightFile}
          selectedFile={rightFile}
          side="right"
        />
      </motion.div>
      
      <ChatWindow
        isExpanded={isChatExpanded}
        onToggle={() => setIsChatExpanded(!isChatExpanded)}
      />
    </main>
  )
}