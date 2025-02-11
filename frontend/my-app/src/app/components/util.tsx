 export async function fetchCSRFToken() {
    try {
      const response = await fetch("http://localhost:8000/api/csrf/", {
        method: "GET",
        credentials: "include",
      });

      if(!response.ok){
        throw new Error(`请求失败，状态码: ${response.status}`);
      }

      const data = await response.json();
      return data.csrfToken;
    } catch (error) {
      console.error("获取 CSRF 令牌失败:", error);
      return false;
    }
  }