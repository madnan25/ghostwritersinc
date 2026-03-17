import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./_components/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get org to check onboarding status and pre-fill name
  const { data: profile } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("name, onboarded_at")
    .eq("id", profile.organization_id)
    .single();

  // Already onboarded — send to dashboard
  if (org?.onboarded_at) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Welcome to Ghostwriters</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell us a bit about you so your agents can get started.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <OnboardingForm orgName={org?.name ?? ""} />
        </div>
      </div>
    </div>
  );
}
