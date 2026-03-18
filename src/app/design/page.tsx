import { redirect } from "next/navigation";
import { PlatformAdminPageShell } from "@/components/platform-admin-page-shell";
import { getCurrentOrgUser } from "@/lib/server-auth";
import { DesignSystemShowcase } from "./_components/design-system-showcase";

export default async function DesignSystemPage() {
  const result = await getCurrentOrgUser();
  if (result.status === "unauthenticated") redirect("/login");
  if (result.status === "inactive") redirect("/account-disabled");
  if (result.status === "profile_missing" || result.status === "query_error") {
    return (
      <div className="premium-page max-w-4xl space-y-6">
        <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.12)_0%,transparent_70%)] blur-3xl" />
          <p className="premium-kicker">Design System</p>
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
      kicker="Design System"
      title="Current Product Language"
      description="A living reference for the current Ghostwriters visual system, typography choices, action hierarchy, and reusable interface patterns."
      detailCards={[
        {
          title: "Source Of Truth",
          description:
            "Shared tokens in `globals.css` and `button-variants.ts` define the system. Product screens should compose from those primitives instead of introducing isolated styling.",
        },
        {
          title: "Button Hierarchy",
          description:
            "`default` is primary, `outline` is secondary, `destructive` is for risky actions, and `ghost` is reserved for tertiary navigation or utility.",
        },
      ]}
    >
        <DesignSystemShowcase />
    </PlatformAdminPageShell>
  );
}
