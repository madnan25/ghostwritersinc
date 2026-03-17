"use client";

import Image from "next/image";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateUserSettings, signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function SettingsForm({
  name,
  email,
  avatarUrl,
  timezone,
  notificationsEnabled,
  linkedInConnected,
  linkedInExpiresAt,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string;
  notificationsEnabled: boolean;
  linkedInConnected: boolean;
  linkedInExpiresAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  function handleLinkedInReconnect() {
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: {
        scopes: "openid profile email w_member_social",
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      },
    });
  }

  function getExpiryLabel(expiresAt: string | null): { text: string; warn: boolean } {
    if (!expiresAt) return { text: "Unknown expiry", warn: false };
    const exp = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return { text: "Token expired", warn: true };
    if (diffDays <= 7) return { text: `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`, warn: true };
    return { text: `Expires ${exp.toLocaleDateString()}`, warn: false };
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateUserSettings(formData);
    });
  }

  return (
    <div className="space-y-8">
      {/* Profile display */}
      <div className="flex items-center gap-4 rounded-lg border p-4">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            width={48}
            height={48}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      {/* Settings form */}
      <form action={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="timezone" className="text-sm font-medium">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={timezone}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="notifications"
            name="notifications"
            defaultChecked={notificationsEnabled}
            className="h-4 w-4 rounded border"
          />
          <label htmlFor="notifications" className="text-sm font-medium">
            Enable in-app notifications
          </label>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>

      {/* LinkedIn connection */}
      <div className="border-t pt-6 space-y-3">
        <h2 className="text-sm font-semibold">LinkedIn Connection</h2>
        {linkedInConnected ? (() => {
          const { text, warn } = getExpiryLabel(linkedInExpiresAt);
          return (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-green-500">Connected</p>
                <p className={`text-xs ${warn ? "text-yellow-500" : "text-muted-foreground"}`}>{text}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLinkedInReconnect}>
                Reconnect
              </Button>
            </div>
          );
        })() : (
          <div className="flex items-center justify-between rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Not connected</p>
            <Button size="sm" onClick={handleLinkedInReconnect}>
              Connect LinkedIn
            </Button>
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="border-t pt-6">
        <form action={signOut}>
          <Button variant="outline" type="submit">
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  );
}
