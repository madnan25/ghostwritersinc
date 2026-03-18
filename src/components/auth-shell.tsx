interface AuthShellProps {
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  visual?: React.ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  visual,
}: AuthShellProps) {
  return (
    <div className="container px-4 md:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl items-center justify-center py-6 md:py-8">
        <section className="dashboard-frame relative w-full overflow-hidden p-5 sm:p-6 lg:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(155,255,82,0.12)_0%,rgba(255,255,255,0.03)_45%,transparent_72%)] blur-3xl"
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.32fr)_minmax(300px,0.76fr)] lg:items-start">
            <div className="flex flex-col">
              <div className="max-w-[48rem] space-y-2.5">
                <p className="premium-kicker text-foreground/84">{eyebrow}</p>
                <h1 className="text-[clamp(2.2rem,3.8vw,3.7rem)] font-semibold tracking-[-0.055em] leading-[0.98]">
                  {title}
                </h1>
                <p className="premium-copy max-w-none text-sm leading-6 sm:text-[0.95rem] sm:leading-7">
                  {description}
                </p>
              </div>
              {visual ? <div className="mt-6 lg:mt-7">{visual}</div> : null}
            </div>

            <div className="dashboard-rail rounded-[28px] p-4 sm:p-5 lg:self-center">
              <div>{children}</div>
              {footer ? <div className="mt-4">{footer}</div> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
