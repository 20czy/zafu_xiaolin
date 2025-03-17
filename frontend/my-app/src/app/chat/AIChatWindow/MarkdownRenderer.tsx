// MarkdownRenderer.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      className="prose prose-sm dark:prose-invert max-w-none"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";
          
          // 代码块
          return (
            <CodeBlock language={language} code={String(children).replace(/\n$/, "")}>
              {children}
            </CodeBlock>
          );
        },
        // 自定义表格样式
        table({ children }) {
          return (
            <div className="overflow-auto my-4">
              <table className="border-collapse border border-muted-foreground/20">
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-muted-foreground/20 px-4 py-2 bg-muted-foreground/5">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-muted-foreground/20 px-4 py-2">
              {children}
            </td>
          );
        },
        // 自定义链接样式
        a({ children, href }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// 代码块组件
function CodeBlock({ language, code, children }: { language: string, code: string, children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      {language && (
        <div className="absolute top-0 right-0 bg-muted-foreground/20 text-xs px-2 py-1 rounded-bl font-mono">
          {language}
        </div>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1 rounded-md bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
        aria-label="复制代码"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: "0.375rem",
          fontSize: "0.875rem",
        }}
        wrapLongLines={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
