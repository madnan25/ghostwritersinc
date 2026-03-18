import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

interface PlatformAdminPageShellProps {
  kicker: string;
  title: string;
  description: string;
  detailCards?: Array<{
    title: string;
    description: string;
  }>;
  children: React.ReactNode;
}

export function PlatformAdminPageShell({
  kicker,
  title,
  description,
  detailCards = [],
  children,
}: PlatformAdminPageShellProps) {
  return (
    <div className="premium-page max-w-6xl space-y-6">
      <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(145,255,88,0.14)_0%,transparent_70%)] blur-3xl" />
        <Link
          href="/settings"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-5 w-fit text-foreground/72 hover:text-foreground"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
          <div>
            <p className="premium-kicker">{kicker}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] text-foreground sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-foreground/68 sm:text-base">
              {description}
            </p>
          </div>
          {detailCards.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {detailCards.map((card) => (
                <div key={card.title} className="dashboard-rail p-5">
                  <p className="premium-kicker text-[0.68rem]">{card.title}</p>
                  <p className="mt-3 text-sm leading-7 text-foreground/66">
                    {card.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-frame p-6 sm:p-8">{children}</div>
    </div>
  );
}
