import { Suspense } from "react";
import { InvitePageClient } from "./_components/invite-page-client";

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-4 text-center">
            <div className="mx-auto h-8 w-32 animate-pulse rounded-lg bg-muted" />
            <div className="mx-auto h-4 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
      }
    >
      <InvitePageClient />
    </Suspense>
  );
}
