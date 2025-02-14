"use client";

import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '@/redux/features/authSlice';
import type { RootState } from '@/redux/store';
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
  const dispatch = useDispatch();
  // 从redux store中读取 auth 的 state ，将值赋给 isLoggedIn 和 user
  const { isLoggedIn, user } = useSelector((state: RootState) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
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
                  {isLoggedIn ? user?.username[0].toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {isLoggedIn ? (
              <>
                <DropdownMenuItem>
                  {user?.username}
                </DropdownMenuItem>
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