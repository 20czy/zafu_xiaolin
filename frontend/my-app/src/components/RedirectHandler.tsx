"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import Cookies from 'js-cookie';

const RedirectHandler = () => {
  const router = useRouter();
  const { isLoggedIn } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Check if user is authenticated via cookies (for initial load)
    const authCookie = Cookies.get('auth');
    const isAuthenticated = !!authCookie;

    // If user is authenticated and on login page, redirect to chat
    if (isAuthenticated && window.location.pathname === '/login') {
      router.push('/chat');
    }
    // If user is not authenticated and not on login or register page, redirect to login
    else if (!isAuthenticated && !['/login', '/register'].includes(window.location.pathname)) {
      router.push('/login');
    }
  }, [isLoggedIn, router]);

  return null;
};

export default RedirectHandler;