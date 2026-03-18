"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export default function AccountDisabledPage() {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <ShieldX className="h-12 w-12 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Account Pending Activation
          </h1>
          <p className="text-muted-foreground">
            Your LinkedIn sign-in succeeded, but this workspace account still needs
            platform-admin approval before you can use the app. If you believe this
            is a mistake, contact Dayem.
          </p>
        </div>
        <Button size="lg" variant="destructive" className="w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
