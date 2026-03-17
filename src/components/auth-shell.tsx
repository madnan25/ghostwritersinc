import { BrandWordmark } from "@/components/brand-wordmark";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="premium-page flex min-h-[calc(100vh-5rem)] items-center justify-center">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden min-h-[620px] flex-col justify-between rounded-[36px] border border-border/60 bg-card/58 p-10 shadow-[0_28px_90px_-42px_rgba(0,0,0,0.54)] backdrop-blur-2xl lg:flex">
          <div className="space-y-8">
            <BrandWordmark href="/" />
            <div className="space-y-4">
              <p className="premium-kicker">
                Editorial Command Center
              </p>
              <h2 className="premium-heading max-w-md text-4xl font-semibold tracking-[-0.05em]">
                Premium infrastructure for disciplined LinkedIn publishing.
              </h2>
              <p className="premium-copy max-w-lg text-base leading-7">
                Review, refine, approve, and ship executive content through a calmer,
                more deliberate workspace designed for teams that care about voice.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="premium-subtle-panel p-4">
              <p className="premium-kicker text-[0.68rem]">Review</p>
              <p className="premium-copy mt-2 text-sm">Sharper feedback loops with cleaner editorial states.</p>
            </div>
            <div className="premium-subtle-panel p-4">
              <p className="premium-kicker text-[0.68rem]">Control</p>
              <p className="premium-copy mt-2 text-sm">Manage agents, permissions, and publishing with confidence.</p>
            </div>
            <div className="premium-subtle-panel p-4">
              <p className="premium-kicker text-[0.68rem]">Presence</p>
              <p className="premium-copy mt-2 text-sm">A more elevated environment for brand-sensitive content work.</p>
            </div>
          </div>
        </div>

        <div className="premium-panel mx-auto w-full max-w-xl p-8 sm:p-10">
          <div className="mb-8 flex lg:hidden">
            <BrandWordmark href="/" compact />
          </div>
          <div className="space-y-3">
            <p className="premium-kicker">
              {eyebrow}
            </p>
            <h1 className="premium-heading text-4xl font-semibold tracking-[-0.05em]">
              {title}
            </h1>
            <p className="premium-copy max-w-lg text-sm leading-7">
              {description}
            </p>
          </div>

          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
