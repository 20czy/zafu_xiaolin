"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 这里应该根据实际的登录状态来设置

  const handleLogout = () => {
    // 实现登出逻辑
    setIsLoggedIn(false);
    router.push('/login');
  };

  return (
    <nav className="border-b px-7 py-3 bg-white">
      <div className="w-full flex justify-between items-center">
        <div className="text-xl font-bold">标书审阅系统</div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 rounded-full">
              <Avatar>
                <AvatarFallback>
                  {isLoggedIn ? "U" : "?"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {isLoggedIn ? (
              <>
                <DropdownMenuItem>个人信息</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  退出登录
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => router.push('/login')}>
                  登录
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/register')}>
                  注册
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}