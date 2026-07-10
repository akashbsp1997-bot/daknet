import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { getRole } from '@/lib/auth';

export function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const [, setLocation] = useLocation();
  const role = getRole();

  useEffect(() => {
    if (!role) {
      setLocation("/login");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(role)) {
      if (role === "super_admin") setLocation("/super/offices");
      else if (role === "office_admin") setLocation("/dashboard");
      else setLocation("/field");
    }
  }, [role, allowedRoles, setLocation]);

  if (!role) return null;
  if (allowedRoles && !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}
