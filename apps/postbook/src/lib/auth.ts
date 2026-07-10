import { UserRole, User } from "@workspace/api-client-react";

export function getToken(): string | null {
  return localStorage.getItem("accessToken");
}

export function setTokens(accessToken: string, refreshToken: string, user: User) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
  localStorage.setItem("userRole", user.role);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("user");
}

export function getRole(): UserRole | null {
  return localStorage.getItem("userRole") as UserRole | null;
}

export function getUser(): User | null {
  const str = localStorage.getItem("user");
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}
