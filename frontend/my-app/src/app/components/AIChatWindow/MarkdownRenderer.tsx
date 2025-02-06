// MarkdownRenderer.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

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
        code({ inline, className, children, ...props }) {
          return !inline ? (
            <pre className="bg-muted-foreground/10 p-2 rounded">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          ) : (
            <code className="bg-muted-foreground/10 px-1 rounded" {...props}>
              {children}
            </code>
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
