import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./_components/settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return (
    <div className="container max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <SettingsForm
        name={profile.name}
        email={profile.email}
        avatarUrl={profile.avatar_url}
        timezone={profile.timezone}
        notificationsEnabled={
          (profile.settings as Record<string, unknown>)?.notifications_enabled !== false
        }
      />
    </div>
  );
}
