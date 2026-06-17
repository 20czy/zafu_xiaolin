"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { login, logout } from '@/redux/features/authSlice';
import { apiUrl } from '@/app/components/util';

const RedirectHandler = () => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/api/v1/auth/me'), { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unauthorized');
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        dispatch(login({ username: data.data.label }));
        if (pathname === '/login' || pathname === '/register') router.replace('/chat');
      })
      .catch(() => {
        if (cancelled) return;
        dispatch(logout());
        if (pathname !== '/login') router.replace('/login');
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, pathname, router]);

  return null;
};

export default RedirectHandler;
