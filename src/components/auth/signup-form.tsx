"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SignupState = {
  error?: string;
  message?: string;
  authenticated?: boolean;
} | null;

export function SignupForm() {
  const router = useRouter();
  const [state, submitAction, isPending] = useActionState<
    SignupState,
    FormData
  >(async (_previousState, formData) => {
    const password = formData.get("password") as string;
    const confirmation = formData.get("passwordConfirmation") as string;

    if (password !== confirmation) {
      return { error: "Passwords do not match" };
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        return { error: data.error?.message || "Signup failed" };
      }

      if (data.authenticated) {
        router.push("/");
      }

      return { message: data.message };
    } catch {
      return { error: "An error occurred during signup" };
    }
  }, null);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
          <h1 className="mb-1 text-center text-2xl font-semibold text-black dark:text-white">
            WorkShopOS
          </h1>
          <p className="mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Create your account
          </p>

          <form action={submitAction} className="space-y-4">
            {state?.error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {state.error}
                </p>
              </div>
            )}
            {state?.message && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-sm text-green-700 dark:text-green-400">
                  {state.message}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                disabled={isPending}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                disabled={isPending}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="passwordConfirmation"
                className="text-sm font-medium"
              >
                Confirm password
              </Label>
              <Input
                id="passwordConfirmation"
                name="passwordConfirmation"
                type="password"
                required
                minLength={6}
                disabled={isPending}
                className="w-full"
              />
            </div>

            <Button type="submit" disabled={isPending} className="h-10 w-full">
              {isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
