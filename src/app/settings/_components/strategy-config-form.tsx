"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveStrategyConfig, type StrategyConfig } from "@/app/actions/strategy";

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const period = i < 12 ? "AM" : "PM";
  const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { value: i, label: `${hour}:00 ${period} (PKT)` };
});

const DEFAULTS: StrategyConfig = {
  monthly_post_target: 4,
  intel_score_threshold: 0.7,
  default_publish_hour: 9,
  voice_notes: null,
  wildcard_count: 0,
};

export function StrategyConfigForm({ initial }: { initial: StrategyConfig | null }) {
  const saved = initial ?? DEFAULTS;

  const [monthlyTarget, setMonthlyTarget] = useState(saved.monthly_post_target);
  const [threshold, setThreshold] = useState(saved.intel_score_threshold);
  const [publishHour, setPublishHour] = useState(saved.default_publish_hour);
  const [voiceNotes, setVoiceNotes] = useState(saved.voice_notes ?? "");
  const [wildcardCount, setWildcardCount] = useState(saved.wildcard_count ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [savedState, setSavedState] = useState({
    monthlyTarget: saved.monthly_post_target,
    threshold: saved.intel_score_threshold,
    publishHour: saved.default_publish_hour,
    voiceNotes: saved.voice_notes ?? "",
    wildcardCount: saved.wildcard_count ?? 0,
  });

  const isDirty = useMemo(() => {
    return (
      monthlyTarget !== savedState.monthlyTarget ||
      threshold !== savedState.threshold ||
      publishHour !== savedState.publishHour ||
      voiceNotes !== savedState.voiceNotes ||
      wildcardCount !== savedState.wildcardCount
    );
  }, [monthlyTarget, threshold, publishHour, voiceNotes, wildcardCount, savedState]);

  function handleSubmit(formData: FormData) {
    formData.set("monthly_post_target", String(monthlyTarget));
    formData.set("intel_score_threshold", String(threshold));
    formData.set("default_publish_hour", String(publishHour));
    formData.set("voice_notes", voiceNotes);
    formData.set("wildcard_count", String(wildcardCount));
    setError(null);
    startTransition(async () => {
      try {
        await saveStrategyConfig(formData);
        setSavedState({ monthlyTarget, threshold, publishHour, voiceNotes, wildcardCount });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="dashboard-rail space-y-5 p-5">
        {/* Monthly post target */}
        <div className="space-y-2">
          <label
            htmlFor="monthly_post_target"
            className="premium-kicker text-[0.72rem] tracking-[0.22em]"
          >
            Monthly Post Target
          </label>
          <div className="flex items-center gap-3">
            <input
              id="monthly_post_target"
              name="monthly_post_target"
              type="number"
              min={1}
              max={100}
              value={monthlyTarget}
              onChange={(e) => setMonthlyTarget(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
              className="w-28 rounded-[22px] border border-input bg-background/72 px-4 py-3 text-sm min-h-[52px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 text-center"
            />
            <p className="text-sm text-foreground/68">posts per month</p>
          </div>
        </div>

        <div className="editorial-rule" />

        {/* Wildcard posts per month */}
        <div className="space-y-2">
          <label
            htmlFor="wildcard_count"
            className="premium-kicker text-[0.72rem] tracking-[0.22em]"
          >
            Wildcard Posts per Month
          </label>
          <div className="flex items-center gap-3">
            <input
              id="wildcard_count"
              name="wildcard_count"
              type="number"
              min={0}
              max={monthlyTarget}
              value={wildcardCount}
              onChange={(e) =>
                setWildcardCount(
                  Math.max(0, Math.min(monthlyTarget, parseInt(e.target.value, 10) || 0)),
                )
              }
              className="w-28 rounded-[22px] border border-input bg-background/72 px-4 py-3 text-sm min-h-[52px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 text-center"
            />
            <p className="text-sm text-foreground/68">unassigned (no pillar)</p>
          </div>
          <p className="text-xs text-foreground/68">
            Briefs created without a content pillar, scheduled evenly across the month.
          </p>
        </div>

        <div className="editorial-rule" />

        {/* Intel score threshold */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="intel_score_threshold"
              className="premium-kicker text-[0.72rem] tracking-[0.22em]"
            >
              Intel Score Threshold
            </label>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {threshold.toFixed(2)}
            </span>
          </div>
          <input
            id="intel_score_threshold"
            name="intel_score_threshold"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
          <div className="flex justify-between text-xs text-foreground/48">
            <span>0.0 (permissive)</span>
            <span>1.0 (strict)</span>
          </div>
          <p className="text-xs text-foreground/68">
            Research items below this score are filtered out of post generation.
          </p>
        </div>

        <div className="editorial-rule" />

        {/* Default publish hour */}
        <div className="space-y-2">
          <label
            htmlFor="default_publish_hour"
            className="premium-kicker text-[0.72rem] tracking-[0.22em]"
          >
            Default Publish Hour
          </label>
          <select
            id="default_publish_hour"
            name="default_publish_hour"
            value={publishHour}
            onChange={(e) => setPublishHour(parseInt(e.target.value, 10))}
            className="w-full rounded-[22px] border border-input bg-background/72 px-4 py-3 text-sm min-h-[52px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            {HOURS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="editorial-rule" />

        {/* Voice notes */}
        <div className="space-y-2">
          <label
            htmlFor="voice_notes"
            className="premium-kicker text-[0.72rem] tracking-[0.22em]"
          >
            Voice Notes
          </label>
          <textarea
            id="voice_notes"
            name="voice_notes"
            value={voiceNotes}
            onChange={(e) => setVoiceNotes(e.target.value)}
            placeholder="Describe your writing style, tone, or any guidelines for post generation…"
            rows={4}
            className="w-full rounded-[22px] border border-input bg-background/72 px-4 py-3 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
          />
          <p className="text-xs text-foreground/68">
            Free-text guidelines passed to the AI when generating posts.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={!isDirty || isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? "Saving…" : "Save Strategy"}
      </Button>
    </form>
  );
}
