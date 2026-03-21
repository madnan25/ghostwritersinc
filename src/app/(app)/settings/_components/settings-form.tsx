"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
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
  canManageOrgSettings,
  contextSharingEnabled,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  timezone: string;
  notificationsEnabled: boolean;
  canManageOrgSettings: boolean;
  contextSharingEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);
  const [notifications, setNotifications] = useState(notificationsEnabled);
  const [contextSharing, setContextSharing] = useState(contextSharingEnabled);
  const [savedSettings, setSavedSettings] = useState(() => ({
    timezone,
    notifications: notificationsEnabled,
    contextSharing: contextSharingEnabled,
  }));

  const isDirty = useMemo(() => {
    if (selectedTimezone !== savedSettings.timezone) return true;
    if (notifications !== savedSettings.notifications) return true;
    if (canManageOrgSettings && contextSharing !== savedSettings.contextSharing) return true;
    return false;
  }, [canManageOrgSettings, contextSharing, notifications, savedSettings, selectedTimezone]);

  function handleSubmit(formData: FormData) {
    // Sync toggle state into form data since we use controlled state
    formData.set("timezone", selectedTimezone);
    if (notifications) {
      formData.set("notifications", "on");
    } else {
      formData.delete("notifications");
    }
    if (contextSharing) {
      formData.set("contextSharingEnabled", "on");
    } else {
      formData.delete("contextSharingEnabled");
    }
    startTransition(async () => {
      await updateUserSettings(formData);
      setSavedSettings({
        timezone: selectedTimezone,
        notifications,
        contextSharing,
      });
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
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
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

          {canManageOrgSettings && (
            <>
              <div className="editorial-rule" />

              <div className="flex items-center justify-between gap-4 min-h-[64px]">
                <div>
                  <p className="text-sm font-medium">Agent context sharing</p>
                  <p className="mt-1 text-xs text-foreground/68">
                    Allow agent keys that are explicitly marked for shared access to
                    read broader org context instead of staying limited to their
                    assigned user.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={contextSharing}
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextSharing((value) => !value);
                  }}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    contextSharing ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      contextSharing ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <input
                  type="checkbox"
                  name="contextSharingEnabled"
                  checked={contextSharing}
                  onChange={() => {}}
                  className="sr-only"
                />
              </div>
            </>
          )}
        </div>

        <Button type="submit" size="lg" disabled={!isDirty || isPending} className="w-full sm:w-auto">
          {isPending ? "Saving…" : "Save Settings"}
        </Button>
      </form>

      <div className="editorial-rule pt-6">
        <form action={signOut}>
          <Button variant="destructive" size="lg" type="submit" className="w-full sm:w-auto">
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  );
}
