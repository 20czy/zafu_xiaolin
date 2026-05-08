"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const RedirectHandler = () => {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/login' || pathname === '/register') {
      router.replace('/chat');
    }
  }, [pathname, router]);

  return null;
};

export default RedirectHandler;
