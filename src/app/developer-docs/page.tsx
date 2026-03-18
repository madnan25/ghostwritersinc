import { redirect } from "next/navigation";
import { PlatformAdminPageShell } from "@/components/platform-admin-page-shell";
import { getCurrentOrgUser } from "@/lib/server-auth";

export default async function DeveloperDocsPage() {
  const result = await getCurrentOrgUser();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "inactive") redirect("/account-disabled");
  if (result.status === "profile_missing" || result.status === "query_error") {
    return (
      <div className="premium-page max-w-4xl space-y-6">
        <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
          <p className="premium-kicker">Developer Docs</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground">
            Internal Reference
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68">
            Your session is active, but your workspace profile could not be loaded for this
            platform-admin screen.
          </p>
        </div>
      </div>
    );
  }

  const { context } = result;
  if (!context.profile.is_platform_admin) {
    redirect("/settings");
  }

  return (
    <PlatformAdminPageShell
      kicker="Developer Docs"
      title="Implementation Notes"
      description="A platform-admin-only area reserved for internal engineering references, architecture notes, and product implementation guidance."
      detailCards={[
        {
          title: "Status",
          description:
            "This page is intentionally a placeholder for now so the internal docs structure exists before deeper engineering guidance is added.",
        },
        {
          title: "Planned Scope",
          description:
            "Use this area later for route conventions, auth flows, data model notes, UI standards, and integration runbooks.",
        },
      ]}
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <p className="premium-kicker text-[0.68rem]">Coming Soon</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
            Developer documentation will live here
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-foreground/66">
            When expanded, this section should document how the platform is structured and
            how new features should align with the existing product system.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="dashboard-rail p-5">
            <p className="premium-kicker text-[0.68rem]">Suggested Sections</p>
            <p className="mt-3 text-sm leading-7 text-foreground/66">
              Authentication, platform admin flows, Supabase patterns, route conventions,
              shared components, and testing expectations.
            </p>
          </div>
          <div className="dashboard-rail p-5">
            <p className="premium-kicker text-[0.68rem]">Relationship To Design</p>
            <p className="mt-3 text-sm leading-7 text-foreground/66">
              The Design System defines product language and UI semantics. Developer Docs
              should explain how those rules are implemented in code.
            </p>
          </div>
        </div>
      </div>
    </PlatformAdminPageShell>
  );
}
