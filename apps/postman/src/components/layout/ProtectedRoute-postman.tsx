import React from "react";
import { Redirect } from "wouter";
import { getRole } from '@/lib/auth';

export function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const role = getRole();

  if (!role) return <Redirect to="/login" />;

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === "super_admin") return <Redirect to="/super/offices" />;
    if (role === "office_admin") return <Redirect to="/dashboard" />;
    return <Redirect to="/field" />;
  }

  return <>{children}</>;
}
