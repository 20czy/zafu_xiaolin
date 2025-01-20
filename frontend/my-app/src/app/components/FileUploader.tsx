'use client'

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Document, Page } from 'react-pdf'
import { pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();


interface FileUploaderProps {
  side: "left" | "right"
}

export default function InputFile({ side }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string>('')
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setFileUrl(URL.createObjectURL(selectedFile))
  }

  const renderFilePreview = () => {
    if (!file) return null

    if (file.type === 'application/pdf') {
      return (
        <div>
          <Document 
            file={fileUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          >
            <Page pageNumber={pageNumber} />
          </Document>
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => setPageNumber(page => Math.max(1, page - 1))}
              disabled={pageNumber <= 1}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              上一页
            </button>
            <span>第 {pageNumber} 页，共 {numPages} 页</span>
            <button
              onClick={() => setPageNumber(page => Math.min(numPages, page + 1))}
              disabled={pageNumber >= numPages}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )
    }
    
    return <p>请上传 PDF 文件</p>
  }

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor={`picture-${side}`}>PDF文件上传</Label>
      <Input 
        id={`picture-${side}`} 
        type="file" 
        accept=".pdf"
        onChange={handleFileChange}
      />
      <div className="mt-4">
        {renderFilePreview()}
      </div>
    </div>
  )
}
