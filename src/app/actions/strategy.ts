"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type StrategyConfig = {
  monthly_post_target: number;
  intel_score_threshold: number;
  default_publish_hour: number;
  voice_notes: string | null;
};

export async function getStrategyConfig(): Promise<StrategyConfig | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  const { data } = await supabase
    .from("strategy_config")
    .select("monthly_post_target, intel_score_threshold, default_publish_hour, voice_notes")
    .eq("user_id", user.id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  return data ?? null;
}

export async function saveStrategyConfig(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");

  const monthly_post_target = parseInt(formData.get("monthly_post_target") as string, 10);
  const intel_score_threshold = parseFloat(formData.get("intel_score_threshold") as string);
  const default_publish_hour = parseInt(formData.get("default_publish_hour") as string, 10);
  const voice_notes = (formData.get("voice_notes") as string) || null;

  if (
    isNaN(monthly_post_target) ||
    monthly_post_target < 1 ||
    monthly_post_target > 100 ||
    isNaN(intel_score_threshold) ||
    intel_score_threshold < 0 ||
    intel_score_threshold > 1 ||
    isNaN(default_publish_hour) ||
    default_publish_hour < 0 ||
    default_publish_hour > 23
  ) {
    throw new Error("Invalid values");
  }

  const { error } = await supabase.from("strategy_config").upsert(
    {
      user_id: user.id,
      organization_id: profile.organization_id,
      monthly_post_target,
      intel_score_threshold,
      default_publish_hour,
      voice_notes,
    },
    { onConflict: "user_id,organization_id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}
