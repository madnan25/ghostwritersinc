import Link from "next/link";

interface BrandWordmarkProps {
  href?: string;
  compact?: boolean;
  size?: "default" | "compact" | "sm";
  tone?: "default" | "muted";
  showWordmark?: boolean;
}

export function BrandWordmark({
  href = "/dashboard",
  compact = false,
  size,
  tone = "default",
  showWordmark = true,
}: BrandWordmarkProps) {
  const resolvedSize = size ?? (compact ? "compact" : "default");

  return (
    <Link
      href={href}
      aria-label={showWordmark ? "Ghostwriters" : "Ghostwriters logo"}
      className={`inline-flex items-center leading-none ${
        resolvedSize === "sm" ? "gap-2" : resolvedSize === "compact" ? "gap-2.5" : "gap-4"
      }`}
    >
      <span
        className={`flex items-center justify-center bg-[#92c936] font-black uppercase text-[#0a0c08] shadow-[0_10px_28px_-14px_rgba(100,210,60,0.55)] ${
          resolvedSize === "sm"
            ? "size-8 rounded-[8px] text-[0.82rem]"
            : resolvedSize === "compact"
              ? "size-9 rounded-[10px] text-[0.92rem]"
              : "size-14 rounded-[16px] text-[1.35rem]"
        }`}
      >
        GW
      </span>
      {showWordmark ? (
        <span
          className={`font-bold tracking-[-0.04em] ${
            tone === "muted" ? "text-foreground/80" : "text-foreground"
          } ${
            resolvedSize === "sm"
              ? "text-[1.1rem]"
              : resolvedSize === "compact"
                ? "text-[1.65rem]"
                : "text-[2.35rem]"
          }`}
        >
          Ghostwriters
          <span className="text-primary">.</span>
        </span>
      ) : null}
    </Link>
  );
}
