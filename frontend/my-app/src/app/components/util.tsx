import { useState } from "react";

// 创建一个独立的获取 CSRF 令牌的函数
async function getCSRFToken() {
  try {
    const response = await fetch("http://localhost:8000/api/csrf/", {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`请求失败，状态码: ${response.status}`);
    }

    const data = await response.json();
    return data.csrfToken;
  } catch (error) {
    console.error("获取 CSRF 令牌失败:", error);
    return null;
  }
}

// 创建通用的 API 请求函数
export async function fetchWithCSRF(url: string, options: RequestInit = {}) {
  try {
    // 获取 CSRF 令牌
    const csrfToken = await getCSRFToken();
    if (!csrfToken) {
      throw new Error("无法获取 CSRF 令牌");
    }

    // 首次请求，已包含 CSRF 令牌
    let response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
        ...options.headers,
      },
    });

    // 处理 CSRF 令牌失效的情况
    if (response.status === 403) {
      // 重新获取 CSRF 令牌
      const newToken = await getCSRFToken();
      if (!newToken) {
        throw new Error("无法获取新的 CSRF 令牌");
      }

      // 使用新令牌重试请求
      response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": newToken,
          ...options.headers,
        },
      });
    }

    if (!response.ok) {
      console.log(response);
      throw new Error(`请求失败，状态码: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("API 请求失败:", error);
    throw error;
  }
}

// 保留 useCSRFToken hook 供组件使用
export function useCSRFToken() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const fetchCSRFToken = async () => {
    const token = await getCSRFToken();
    setCsrfToken(token);
    return token;
  };

  return { csrfToken, fetchCSRFToken };
}
