"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoggedIn } = useSelector((state: RootState) => state.auth);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Skip protection for login and register pages
    if (pathname === '/login' || pathname === '/register') {
      setIsChecking(false);
      return;
    }
    
    // If user is not logged in, redirect to login
    if (!isLoggedIn) {
      router.replace('/login');
    } else {
      // User is logged in, stop checking
      setIsChecking(false);
    }
  }, [isLoggedIn, router, pathname]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If not logged in and not on login/register page, don't render children
  if (!isLoggedIn && pathname !== '/login' && pathname !== '/register') {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;