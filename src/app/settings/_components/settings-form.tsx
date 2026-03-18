"use client";

import Image from "next/image";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { updateUserSettings, signOut } from "@/app/actions/auth";
import { startLinkedInOAuth } from "@/lib/linkedin-oauth";

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

  async function handleLinkedInReconnect() {
    await startLinkedInOAuth("/settings");
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
      <div className="dashboard-rail flex items-center gap-4 p-5">
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
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-primary/25 bg-primary/12 text-lg font-semibold text-primary">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-lg font-semibold tracking-[-0.03em]">{name}</p>
          <p className="text-sm text-foreground/72">{email}</p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-5">
        <div className="dashboard-rail space-y-5 p-5">
          <div className="space-y-2">
            <label htmlFor="timezone" className="premium-kicker text-[0.72rem] tracking-[0.22em]">
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={timezone}
              className="w-full rounded-[22px] border border-input bg-background/72 px-4 py-3 text-sm min-h-[52px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="editorial-rule" />

          <div className="flex items-center justify-between gap-4 min-h-[64px]">
            <div>
              <p className="text-sm font-medium">In-app notifications</p>
              <p className="mt-1 text-xs text-foreground/68">
                Get notified when posts need review
              </p>
            </div>
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
            <input
              type="checkbox"
              name="notifications"
              checked={notifications}
              onChange={() => {}}
              className="sr-only"
            />
          </div>
        </div>

        <Button type="submit" disabled={isPending} className="w-full h-[52px] rounded-xl text-base sm:w-auto sm:h-auto sm:rounded-lg sm:text-sm">
          {isPending ? "Saving…" : "Save Settings"}
        </Button>
      </form>

      <div className="space-y-3">
        <h2 className="premium-kicker text-[0.72rem] tracking-[0.24em]">LinkedIn Connection</h2>
        {linkedInConnected ? (() => {
          const { text, warn } = getExpiryLabel(linkedInExpiresAt);
          return (
            <div className="dashboard-rail flex items-center justify-between p-5 min-h-[72px]">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-emerald-400">Connected</p>
                <p className={`text-xs ${warn ? "text-yellow-300" : "text-foreground/68"}`}>{text}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLinkedInReconnect} className="min-h-[40px]">
                Reconnect
              </Button>
            </div>
          );
        })() : (
          <div className="dashboard-rail flex items-center justify-between p-5 min-h-[72px]">
            <p className="text-sm text-foreground/68">Not connected</p>
            <Button size="sm" onClick={handleLinkedInReconnect} className="min-h-[40px]">
              Connect LinkedIn
            </Button>
          </div>
        )}
      </div>

      <div className="editorial-rule pt-6">
        <form action={signOut}>
          <Button variant="outline" type="submit" className="w-full h-[52px] rounded-xl text-base sm:w-auto sm:h-auto sm:rounded-lg sm:text-sm">
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  );
}
