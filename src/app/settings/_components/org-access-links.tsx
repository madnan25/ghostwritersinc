import Link from "next/link";

const ORG_ACCESS_LINKS = [
  {
    kicker: "Hiring Agents",
    description:
      "Request a preset Ghostwriters agent team for specific users in your organization.",
    href: "/settings/agents",
    cta: "Hire Agent Team",
  },
  {
    kicker: "Team Access",
    description:
      "Invite collaborators, adjust roles, and keep the editorial workspace secure.",
    href: "/settings/users",
    cta: "Manage Users",
  },
] as const;

export function OrgAccessLinks({ disabled }: { disabled: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
      {ORG_ACCESS_LINKS.map((item) =>
        disabled ? (
          <div
            key={item.href}
            aria-disabled="true"
            className="dashboard-rail p-5 opacity-55"
          >
            <p className="premium-kicker text-[0.68rem]">{item.kicker}</p>
            <p className="mt-3 text-sm leading-7 text-foreground/66">{item.description}</p>
            <p className="mt-4 inline-flex text-sm font-medium text-foreground/40">
              {item.cta} →
            </p>
          </div>
        ) : (
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
        )
      )}
    </div>
  );
}
