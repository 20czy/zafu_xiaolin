import type { Metadata } from "next";
import "./globals.css";
import ReduxProvider from "@/providers/ReduxProvider";
import RedirectHandler from "@/components/RedirectHandler";

export const metadata: Metadata = {
  title: "农林小林 - 校园AI助手",
  description: "基于MCP的全栈校园AI助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <ReduxProvider>
          <RedirectHandler />
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}
