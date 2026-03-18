import Link from "next/link";

const PLATFORM_ADMIN_CONTROL_LINKS = [
  {
    kicker: "Commissioned Agents",
    description:
      "Provision agent identities, manage agent keys, and control the permission model behind automated editorial work.",
    href: "/settings/agents",
    cta: "Open Agent Controls",
  },
  {
    kicker: "Platform User Access",
    description:
      "Review platform-level account access, activation state, and the current direct invitation system for workspace users.",
    href: "/settings/users",
    cta: "Open User Controls",
  },
] as const;

const PLATFORM_ADMIN_RESOURCE_LINKS = [
  {
    title: "Design System",
    description:
      "Reference the current UI foundations, typography, action hierarchy, and reusable surfaces.",
    href: "/design",
  },
  {
    title: "Developer Docs",
    description:
      "Reserved for implementation notes, architecture references, and internal build guidance.",
    href: "/developer-docs",
  },
] as const;

export function PlatformAdminLinks() {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {PLATFORM_ADMIN_CONTROL_LINKS.map((item) => (
        <div key={item.href} className="dashboard-rail p-5">
          <p className="premium-kicker text-[0.68rem]">{item.kicker}</p>
          <p className="mt-3 text-sm leading-7 text-foreground/66">{item.description}</p>
          <Link
            href={item.href}
            className="mt-4 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            {item.cta} →
          </Link>
        </div>
      ))}

      <div className="dashboard-rail p-5">
        <p className="premium-kicker text-[0.68rem]">Internal Resources</p>
        <p className="mt-3 text-sm leading-7 text-foreground/66">
          Platform-admin-only references for product language, implementation guidance,
          and future engineering docs.
        </p>
        <div className="mt-4 space-y-3">
          {PLATFORM_ADMIN_RESOURCE_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="editorial-card block p-4 transition-colors hover:border-border/80"
            >
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-foreground/66">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
