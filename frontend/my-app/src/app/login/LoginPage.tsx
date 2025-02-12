"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useDispatch } from 'react-redux';
import { login } from '@/redux/features/authSlice';
import { useCSRFToken, fetchWithCSRF } from "../components/util";

// 定义表单验证架构
const formSchema = z.object({
  username: z.string().min(2, {
    message: "用户名至少需要2个字符",
  }),
  password: z.string().min(6, {
    message: "密码至少需要6个字符",
  }),
});

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);

  // 初始化表单
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // 处理表单提交
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const data = await fetchWithCSRF("http://localhost:8000/api/login/", {
        method: "POST",
        body: JSON.stringify(values),
      });

      if (data.status === "success") {
        dispatch(login({
          username: data.data.username,
          id: data.data.id
        }));
        router.push("/");
      } else {
        form.setError("root", {
          message: "登录失败：" + data.message,
        });
      }
    } catch (error) {
      console.error(error);
      form.setError("root", {
        message: "网络错误，请稍后重试",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <Card className="w-[350px]">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>登录</CardTitle>
              <CardDescription>
                请输入您的账号和密码进行登录
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              onClick={() => router.push("/register")}
            >
              注册
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="请输入用户名" 
                        {...field} 
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>密码</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="请输入密码" 
                        {...field} 
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <div className="text-sm text-red-500">
                  {form.formState.errors.root.message}
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "登录中..." : "登录"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}