'use client'

import { useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Document, Page } from 'react-pdf'
import { pdfjs } from 'react-pdf'
import { toast } from "sonner" // 假设使用sonner作为提示组件
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// 配置PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// 定义类型
interface FileUploaderProps {
  side: "left" | "right"
  onUploadSuccess?: (fileData: { id: number; url: string }) => void
  maxFileSize?: number // 单位：MB
}

export default function FileUploader({ 
  side, 
  onUploadSuccess,
  maxFileSize = 10 // 默认最大10MB
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string>('')
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [isUploading, setIsUploading] = useState(false)

  // 文件验证
  const validateFile = (file: File): boolean => {
    if (!file.type.includes('pdf')) {
      toast.error('请上传PDF文件')
      return false
    }

    if (file.size > maxFileSize * 1024 * 1024) {
      toast.error(`文件大小不能超过${maxFileSize}MB`)
      return false
    }

    return true
  }

  // 处理文件上传
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!validateFile(selectedFile)) {
      e.target.value = '' // 清空input
      return
    }

    setFile(selectedFile)
    setFileUrl(URL.createObjectURL(selectedFile))

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/upload-pdf/', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const data = await response.json()
      toast.success('文件上传成功')
      onUploadSuccess?.(data)
    } catch (error) {
      console.error('上传错误:', error)
      toast.error('文件上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }

  // 处理页面导航
  const handlePageChange = useCallback((delta: number) => {
    setPageNumber(prevPage => {
      const newPage = prevPage + delta
      return Math.max(1, Math.min(newPage, numPages))
    })
  }, [numPages])

  // 清理文件
  const handleClearFile = useCallback(() => {
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl)
    }
    setFile(null)
    setFileUrl('')
    setPageNumber(1)
    setNumPages(0)
  }, [fileUrl])

  // 渲染PDF预览
  const renderFilePreview = () => {
    if (!file) return null

    return (
      <div className="relative">
        <Document 
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => toast.error('PDF加载失败')}
          loading={<div>加载中...</div>}
        >
          <Page 
            pageNumber={pageNumber} 
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
        
        {numPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => handlePageChange(-1)}
              disabled={pageNumber <= 1 || isUploading}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors"
            >
              上一页
            </button>
            <span>第 {pageNumber} 页，共 {numPages} 页</span>
            <button
              onClick={() => handlePageChange(1)}
              disabled={pageNumber >= numPages || isUploading}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor={`pdf-${side}`}>PDF文件上传</Label>
      <Input 
        id={`pdf-${side}`} 
        type="file" 
        accept=".pdf"
        onChange={handleFileChange}
        disabled={isUploading}
        className="cursor-pointer"
      />
      {isUploading && (
        <div className="mt-2 text-blue-500">
          正在上传...
        </div>
      )}
      {file && (
        <button
          onClick={handleClearFile}
          className="mt-2 text-red-500 hover:text-red-700 transition-colors"
        >
          清除文件
        </button>
      )}
      <div className="mt-4">
        {renderFilePreview()}
      </div>
    </div>
  )
}