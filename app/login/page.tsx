"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useCont } from "@/components/Context";

export default function LoginPage() {
  const router = useRouter();
  const { setIsAuthenticated } = useCont();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const result: { error?: string; user?: { role?: string } } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to log in. Please try again.");
        return;
      }

      setIsAuthenticated(true);
      router.replace(result.user?.role === "admin" ? "/admin" : "/");
      router.refresh();
    } catch {
      setError("Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#294d7d] focus:ring-2 focus:ring-[#294d7d]/15";

  return (
    <main className="grid min-h-screen bg-[#f5f7fb] lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[#102c56] p-12 text-white lg:flex">
        <div className="flex items-center gap-4">
          <Image src="/pau-logo2.png" alt="PAU" width={48} height={48} className="h-12 w-12 object-contain" />
          <span className="text-sm font-semibold uppercase tracking-widest text-white">
            Hostel Management System
          </span>
        </div>
        <div className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
            Pan-Atlantic University
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Welcome back to your campus portal.
          </h1>
          <p className="mt-4 leading-7 text-blue-100">
            Sign in to access your student services and hostel information.
          </p>
        </div>
        <span className="text-xs text-blue-200">© Ayomide Kareem</span>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/4 sm:p-9">
          <div className="mb-7 lg:hidden">
            <Image src="/pau-logo2.png" alt="PAU" width={44} height={44} className="h-11 w-11 object-contain" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7538]">Student portal</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#102c56]">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Log in with your name or email and password.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            {error && (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </p>
            )}
            <div>
              <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-slate-700">
                Name or email
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                maxLength={254}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Enter your name or email"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#102c56] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#193d70] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New student?{" "}
            <Link href="/signup" className="font-semibold text-[#102c56] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
