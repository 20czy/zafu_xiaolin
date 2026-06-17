import { useState } from "react";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export async function fetchWithCSRF(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.location.assign("/login");
    throw new Error("访问会话已失效");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `请求失败，状态码: ${response.status}`);
  }
  return response.json();
}

export function useCSRFToken() {
  const [csrfToken] = useState<string | null>(null);
  return { csrfToken, fetchCSRFToken: async () => null };
}
