"use client";

import Image from "next/image";
import { useTransition, useState } from "react";
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
  const [notifications, setNotifications] = useState(notificationsEnabled);

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
    // Sync toggle state into form data since we use controlled state
    if (notifications) {
      formData.set("notifications", "on");
    } else {
      formData.delete("notifications");
    }
    startTransition(async () => {
      await updateUserSettings(formData);
    });
  }

  return (
    <div className="space-y-6">
      {/* Profile display */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            width={52}
            height={52}
            className="rounded-full ring-2 ring-primary/20"
            unoptimized
          />
        ) : (
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      {/* Settings form */}
      <form action={handleSubmit} className="space-y-5">
        {/* Timezone */}
        <div className="space-y-2">
          <label htmlFor="timezone" className="text-sm font-medium">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={timezone}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Notifications toggle */}
        <div
          className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 cursor-pointer min-h-[56px]"
          onClick={() => setNotifications((v) => !v)}
        >
          <div>
            <p className="text-sm font-medium">In-app notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Get notified when posts need review
            </p>
          </div>
          {/* Custom toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={notifications}
            onClick={(e) => { e.stopPropagation(); setNotifications((v) => !v) }}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              notifications
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                notifications ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
          {/* Hidden checkbox for form submission */}
          <input
            type="checkbox"
            name="notifications"
            checked={notifications}
            onChange={() => {}}
            className="sr-only"
          />
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-[52px] rounded-2xl text-base sm:w-auto sm:h-auto sm:rounded-lg sm:text-sm">
          {isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>

      {/* LinkedIn connection */}
      <div className="border-t border-border pt-6 space-y-3">
        <h2 className="text-sm font-semibold">LinkedIn Connection</h2>
        {linkedInConnected ? (() => {
          const { text, warn } = getExpiryLabel(linkedInExpiresAt);
          return (
            <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 min-h-[64px]">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-emerald-500">Connected</p>
                <p className={`text-xs ${warn ? "text-yellow-500" : "text-muted-foreground"}`}>{text}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLinkedInReconnect} className="min-h-[40px]">
                Reconnect
              </Button>
            </div>
          );
        })() : (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 min-h-[64px]">
            <p className="text-sm text-muted-foreground">Not connected</p>
            <Button size="sm" onClick={handleLinkedInReconnect} className="min-h-[40px]">
              Connect LinkedIn
            </Button>
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="border-t border-border pt-6">
        <form action={signOut}>
          <Button variant="outline" type="submit" className="w-full h-[52px] rounded-2xl text-base sm:w-auto sm:h-auto sm:rounded-lg sm:text-sm">
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  );
}
