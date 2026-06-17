"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { apiUrl } from "@/app/components/util";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { login } from "@/redux/features/authSlice";
import type { RootState } from "@/redux/store";

const formSchema = z.object({
  token: z.string().min(20, "请输入完整的试用访问码"),
});

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isLoggedIn } = useSelector((state: RootState) => state.auth);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { token: "" },
  });

  useEffect(() => {
    if (isLoggedIn) router.push("/chat");
  }, [isLoggedIn, router]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl("/api/v1/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "访问码无效");
      dispatch(login({ username: data.data.label }));
      router.push("/chat");
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "验证失败，请稍后重试",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-[380px]">
        <CardHeader>
          <CardTitle>内部试用</CardTitle>
          <CardDescription>请输入管理员分享给你的限时访问码</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>试用访问码</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="trial_..." {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <div className="text-sm text-red-500">{form.formState.errors.root.message}</div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "验证中..." : "进入应用"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                获取访问码或遇到问题，请联系管理员：
                <a
                  className="ml-1 text-primary underline-offset-4 hover:underline"
                  href="mailto:charn18658569539@gmail.com"
                >
                  charn18658569539@gmail.com
                </a>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
