import React, { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { setTokens } from "@/lib/auth";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    login.mutate(
      { data: { username, password } },
      {
        onSuccess: (data) => {
          setTokens(data.accessToken, data.refreshToken, data.user);
          setLocation("/addresses");
        },
        onError: (err) => {
          toast({
            title: "Login failed",
            description: err.data?.message || "Please check your credentials and try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center items-center p-4 bg-muted/30">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-lg border">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4 shadow-md">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">POSTBOOK</h1>
          <p className="text-muted-foreground text-sm mt-1 text-center">
            Address Intelligence — Department of Posts
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username or Employee ID</Label>
            <Input
              id="username"
              placeholder="e.g. jdoe or EMP123"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 text-base"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-base"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full h-12 text-base font-semibold mt-6" disabled={login.isPending}>
            {login.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Secure Login
          </Button>
        </form>
      </div>
    </div>
  );
}
