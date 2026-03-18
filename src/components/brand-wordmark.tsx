import Link from "next/link";

interface BrandWordmarkProps {
  href?: string;
  compact?: boolean;
}

export function BrandWordmark({
  href = "/dashboard",
  compact = false,
}: BrandWordmarkProps) {
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <span className="lime-gradient-bg flex size-10 items-center justify-center rounded-full text-[0.68rem] font-bold uppercase tracking-[0.28em] text-[#0a1a08] shadow-[0_10px_28px_-14px_rgba(100,210,60,0.55)]">
        GW
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.36em] text-primary/90">
          Ghostwriters
        </span>
        <span className={`lime-gradient-text font-bold tracking-[-0.04em] ${compact ? "text-lg" : "text-xl"}`}>
          Inc.
        </span>
      </span>
    </Link>
  );
}
