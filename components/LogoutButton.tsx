"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCont } from "@/components/Context";

export default function LogoutButton() {
  const router = useRouter();
  const { setIsAuthenticated } = useCont();
  const [error, setError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setError("");
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Logout failed.");
      }
      setIsAuthenticated(false);
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to log out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={logout}
        disabled={isLoggingOut}
        className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {isLoggingOut ? "Logging out..." : "Log out"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
