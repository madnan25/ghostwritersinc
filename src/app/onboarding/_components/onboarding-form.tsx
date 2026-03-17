"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/app/actions/auth";

interface OnboardingFormProps {
  orgName: string;
}

export function OnboardingForm({ orgName }: OnboardingFormProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await completeOnboarding(formData);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="orgName" className="text-sm font-medium">
          Organization name
        </label>
        <input
          id="orgName"
          name="orgName"
          type="text"
          required
          defaultValue={orgName}
          placeholder="Your company or personal brand name"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="linkedinProfileUrl" className="text-sm font-medium">
          LinkedIn profile URL
        </label>
        <input
          id="linkedinProfileUrl"
          name="linkedinProfileUrl"
          type="url"
          placeholder="https://linkedin.com/in/your-handle"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Used by your agents to tailor content to your audience.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="contentGoals" className="text-sm font-medium">
          Content goals
        </label>
        <textarea
          id="contentGoals"
          name="contentGoals"
          rows={4}
          placeholder="e.g. Build authority in B2B SaaS, generate inbound leads, share lessons from building a startup..."
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <p className="text-xs text-muted-foreground">
          What do you want your LinkedIn content to achieve?
        </p>
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Setting up your workspace…" : "Get started"}
      </Button>
    </form>
  );
}
