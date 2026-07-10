import React from "react";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { getUser, clearTokens } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Shell({ children }: { children: React.ReactNode }) {
  const user = getUser();
  const [, setLocation] = useLocation();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        clearTokens();
        setLocation("/login");
      },
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 h-14 max-w-3xl mx-auto w-full">
          <Link href="/addresses" className="flex items-center gap-2 font-bold tracking-tight">
            <BookOpen className="w-5 h-5 text-primary" />
            POSTBOOK
          </Link>
          <div className="flex items-center gap-3">
            {user?.name && <span className="text-sm text-muted-foreground hidden sm:inline">{user.name}</span>}
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Log out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full">{children}</main>
    </div>
  );
}
