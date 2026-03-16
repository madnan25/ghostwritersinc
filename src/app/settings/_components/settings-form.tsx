"use client";

import Image from "next/image";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateUserSettings, signOut } from "@/app/actions/auth";

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
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string;
  notificationsEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();

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
