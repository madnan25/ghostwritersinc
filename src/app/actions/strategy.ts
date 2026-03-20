"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VoiceObservation } from "@/lib/types";

export type StrategyConfig = {
  monthly_post_target: number;
  intel_score_threshold: number;
  default_publish_hour: number;
  voice_notes: string | null;
  wildcard_count: number;
  posting_days: number[];
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
    .select("monthly_post_target, intel_score_threshold, default_publish_hour, voice_notes, wildcard_count, posting_days")
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
  const wildcard_count = parseInt(formData.get("wildcard_count") as string, 10) || 0;
  const posting_days_raw = JSON.parse((formData.get("posting_days") as string) || "[]") as unknown[];
  const posting_days = Array.isArray(posting_days_raw)
    ? posting_days_raw.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];

  if (
    isNaN(monthly_post_target) ||
    monthly_post_target < 1 ||
    monthly_post_target > 100 ||
    isNaN(intel_score_threshold) ||
    intel_score_threshold < 0 ||
    intel_score_threshold > 1 ||
    isNaN(default_publish_hour) ||
    default_publish_hour < 0 ||
    default_publish_hour > 23 ||
    wildcard_count < 0 ||
    wildcard_count > 50 ||
    wildcard_count > monthly_post_target ||
    posting_days.length === 0
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
      wildcard_count,
      posting_days,
    },
    { onConflict: "user_id,organization_id" }
  );

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

// ---------------------------------------------------------------------------
// Scout instructions context
// ---------------------------------------------------------------------------

export type ScoutContextData = {
  context: string | null
  updatedAt: string | null
}

export async function getScoutContext(): Promise<ScoutContextData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { context: null, updatedAt: null };

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile) return { context: null, updatedAt: null };

  const { data } = await supabase
    .from("strategy_config")
    .select("scout_context, updated_at")
    .eq("user_id", user.id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  return {
    context: (data as { scout_context?: string | null } | null)?.scout_context ?? null,
    updatedAt: (data as { updated_at?: string | null } | null)?.updated_at ?? null,
  };
}

export async function saveScoutContext(context: string) {
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

  if (!context || context.length === 0) {
    // Clear scout_context
    const { error } = await supabase
      .from("strategy_config")
      .update({ scout_context: null })
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id);
    if (error) throw new Error(error.message);
  } else {
    if (context.length > 10000) throw new Error("Scout context too long (max 10,000 characters)");
    // Try update first; if no row exists yet, upsert with defaults
    const { data: updated, error: updateErr } = await supabase
      .from("strategy_config")
      .update({ scout_context: context })
      .eq("user_id", user.id)
      .eq("organization_id", profile.organization_id)
      .select("id");
    if (updateErr) throw new Error(updateErr.message);
    if (!updated || updated.length === 0) {
      // Row doesn't exist yet — create with scout_context and sensible defaults
      const { error: insertErr } = await supabase.from("strategy_config").insert({
        user_id: user.id,
        organization_id: profile.organization_id,
        scout_context: context,
        monthly_post_target: 4,
        intel_score_threshold: 0.5,
        default_publish_hour: 9,
      });
      if (insertErr) throw new Error(insertErr.message);
    }
  }

  revalidatePath("/strategy");
}

// ---------------------------------------------------------------------------
// Posting days update (LIN-487)
// ---------------------------------------------------------------------------

export async function updatePostingDays(postingDays: number[]) {
  if (!Array.isArray(postingDays) || postingDays.length === 0) {
    throw new Error('At least one posting day must be selected')
  }
  const valid = postingDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  if (!valid) throw new Error('Invalid posting days — must be integers 0–6')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')

  const { error } = await supabase
    .from('strategy_config')
    .upsert(
      {
        user_id: user.id,
        organization_id: profile.organization_id,
        posting_days: postingDays.sort((a, b) => a - b),
      },
      { onConflict: 'user_id,organization_id' },
    )

  if (error) throw new Error(error.message)

  revalidatePath('/strategy')
}

// ---------------------------------------------------------------------------
// Voice Learning — observation actions (LIN-503)
// ---------------------------------------------------------------------------

export interface VoiceObservationsData {
  observations: VoiceObservation[]
  diffCount: number
}

export async function getVoiceObservationsData(): Promise<VoiceObservationsData> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { observations: [], diffCount: 0 }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { observations: [], diffCount: 0 }

  const [{ data: observations }, { count: diffCount }] = await Promise.all([
    supabase
      .from('voice_observations')
      .select('*')
      .eq('user_id', user.id)
      .eq('organization_id', profile.organization_id)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false }),
    supabase
      .from('post_diffs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('organization_id', profile.organization_id),
  ])

  return {
    observations: (observations as VoiceObservation[] | null) ?? [],
    diffCount: diffCount ?? 0,
  }
}

export async function confirmObservation(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')

  const { data: existing } = await supabase
    .from('voice_observations')
    .select('status')
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('organization_id', profile.organization_id)
    .single()
  if (existing?.status === 'dismissed') {
    throw new Error('Cannot confirm a dismissed observation')
  }

  const { error } = await supabase
    .from('voice_observations')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), dismissed_at: null })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('organization_id', profile.organization_id)

  if (error) throw new Error(error.message)
  revalidatePath('/strategy')
}

export async function dismissObservation(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')

  const { error } = await supabase
    .from('voice_observations')
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString(), confirmed_at: null })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('organization_id', profile.organization_id)

  if (error) throw new Error(error.message)
  revalidatePath('/strategy')
}

export async function editObservation(id: string, observation: string): Promise<void> {
  const text = observation.trim()
  if (!text || text.length > 2000) throw new Error('Invalid observation text')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')

  const { error } = await supabase
    .from('voice_observations')
    .update({ observation: text })
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('organization_id', profile.organization_id)

  if (error) throw new Error(error.message)
  revalidatePath('/strategy')
}

// ---------------------------------------------------------------------------
// Pillar weight updates (LIN-473)
// ---------------------------------------------------------------------------

export type PillarWeightScope = 'default' | 'monthly'

export interface PillarWeightEntry {
  pillarId: string
  weightPct: number
}

export async function updatePillarWeights(
  weights: PillarWeightEntry[],
  scope: PillarWeightScope,
) {
  if (weights.length === 0) throw new Error('No weights provided')

  const total = weights.reduce((sum, w) => sum + w.weightPct, 0)
  if (Math.abs(total - 100) >= 0.01) throw new Error(`Weights must sum to 100% (got ${total}%)`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')

  // pillar_weights stored as JSONB {[pillarId]: weightPct} in strategy_config
  const pillarWeightsMap = Object.fromEntries(weights.map((w) => [w.pillarId, w.weightPct]))

  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { error } = await supabase
    .from('strategy_config')
    .upsert(
      {
        user_id: user.id,
        organization_id: profile.organization_id,
        pillar_weights: pillarWeightsMap,
        pillar_weights_scope: scope,
        pillar_weights_month: scope === 'monthly' ? monthStr : null,
      },
      { onConflict: 'user_id,organization_id' },
    )

  if (error) throw new Error(error.message)

  revalidatePath('/strategy')
}
