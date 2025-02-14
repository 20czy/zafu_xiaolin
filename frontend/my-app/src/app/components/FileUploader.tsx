"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Document, Page } from "react-pdf";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { fetchWithCSRF, getCSRFToken } from "./util";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface FileUploaderProps {
  side: "left" | "right";
  sessionId: number | null; // 添加会话ID属性
}

export default function InputFile({ side, sessionId }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [numPages, setNumPages] = useState<number>(0);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [uploadStatus, setUploadStatus] = useState<string>("");

   // 在会话ID变化时获取对应的文档
   useEffect(() => {
    if (sessionId) {
      fetchSessionDocument();
    }
  }, [sessionId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setFileUrl(URL.createObjectURL(selectedFile));

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("session_id", sessionId?.toString() || "");  // 添加会话ID，将number|null转换为string

      const token = await getCSRFToken();
      
      const response = await fetch("http://localhost:8000/api/upload_pdf/", {
        method: "POST",
        headers: {
          "X-CSRFToken": token,
        },
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "文件上传失败");
      }

      const data = await response.json();
      setDocumentId(data.data.id);
      setFileUrl(data.data.url);
      setUploadStatus("上传成功");
    } catch (error) {
      console.error("文件上传失败", error);
      setUploadStatus(typeof error === 'string' ? error : "文件上传失败");
    }
  };

  const fetchSessionDocument = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/chat/sessions/${sessionId}/documents/`, {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("会话文档数据:", data); // 添加详细日志
        
        // data.data 是一个数组，需要获取第一个文档
        if (data.data && data.data.length > 0) {
          const document = data.data[0]; // 获取第一个文档
          setDocumentId(document.id);
          setFileUrl(document.url);
          setUploadStatus("文件加载成功");
          
          // 创建一个临时的 File 对象用于预览
          fetch(document.url)
            .then(res => res.blob())
            .then(blob => {
              const file = new File([blob], document.title, { type: 'application/pdf' });
              setFile(file);
            })
            .catch(error => {
              console.error("获取文件内容失败:", error);
              setUploadStatus("文件加载失败");
            });
        }
      }
    } catch (error) {
      console.error("获取会话文档失败", error);
      setUploadStatus("获取文档失败");
    }
  };

  const renderFilePreview = () => {
    if (!fileUrl) return null;

    return (
      <div>
        <div className="max-h-[600px] overflow-y-auto border rounded-lg p-4">
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages }) => {
              setNumPages(numPages);
              console.log("PDF加载成功，页数:", numPages);
            }}
            onLoadError={(error) => {
              console.error("PDF加载失败:", error);
              setUploadStatus("PDF加载失败，请刷新重试");
            }}
            loading={<div className="text-center">PDF加载中...</div>}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <Page 
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                className="mb-4"
                loading={<div className="text-center">页面加载中...</div>}
                error={<div className="text-red-500">页面加载失败</div>}
              />
            ))}
          </Document>
        </div>
        <div className="text-center mt-2">
          {numPages > 0 ? `共 ${numPages} 页` : '加载中...'}
        </div>
      </div>
    );
  };

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor={`picture-${side}`} className="text-xl font-semibold">
        {side === "left" ? "招标书文件上传" : "应标书文件上传"}
      </Label>
      <Input
        id={`picture-${side}`}
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
      />
      {uploadStatus && (
        <p
          className={`mt-2 ${
            uploadStatus.includes("成功") ? "text-green-500" : "text-red-500"
          }`}
        >
          {uploadStatus}
        </p>
      )}
      <div className="mt-4">{renderFilePreview()}</div>
    </div>
  );
}
