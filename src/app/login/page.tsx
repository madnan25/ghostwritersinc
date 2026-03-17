import { Suspense } from "react";
import { LoginClient } from "./_components/login-client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="mx-auto h-9 w-48 animate-pulse rounded-lg bg-muted" />
            <div className="mx-auto h-4 w-56 animate-pulse rounded bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
