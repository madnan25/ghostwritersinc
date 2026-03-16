"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateUserSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const timezone = formData.get("timezone") as string;

  // Get existing settings to merge
  const { data: existingUser } = await supabase
    .from("users")
    .select("settings")
    .eq("id", user.id)
    .single();

  const settings = {
    ...(existingUser?.settings as Record<string, unknown> || {}),
    timezone_preference: timezone,
    notifications_enabled: formData.get("notifications") === "on",
  };

  const { error } = await supabase
    .from("users")
    .update({ timezone, settings })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
}
