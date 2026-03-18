export const foundationTokens = [
  {
    name: "Background",
    cssVar: "--background",
    textVar: "--foreground",
    usage: "Primary application canvas and shell backdrop.",
  },
  {
    name: "Card",
    cssVar: "--card",
    textVar: "--card-foreground",
    usage: "Main surface color for premium frames and cards.",
  },
  {
    name: "Primary",
    cssVar: "--primary",
    textVar: "--primary-foreground",
    usage: "Brand lime accent for primary CTAs and highlights.",
  },
  {
    name: "Secondary",
    cssVar: "--secondary",
    textVar: "--secondary-foreground",
    usage: "Muted utility tone for softer surfaces and controls.",
  },
  {
    name: "Destructive",
    cssVar: "--destructive",
    textVar: "--primary-foreground",
    usage: "Danger actions such as account removal or sign out.",
  },
  {
    name: "Border",
    cssVar: "--border",
    textVar: "--foreground",
    usage: "Subtle frame definition across glass surfaces.",
  },
] as const;

export const typographyStyles = [
  {
    name: "Primary UI Font",
    className: "",
    previewClassName: "text-2xl font-semibold tracking-[-0.04em]",
    sample: "Switzer",
    notes: "Primary interface and display font used across the product shell and content UI.",
  },
  {
    name: "Monospace Support Font",
    className: "font-mono",
    previewClassName: "text-lg",
    sample: "Geist Mono",
    notes: "Reserved for code, tokens, identifiers, and internal technical references.",
  },
  {
    name: "Premium Kicker",
    className: "premium-kicker",
    previewClassName: "",
    sample: "Editorial System",
    notes: "Uppercase section labels and compact metadata headings.",
  },
  {
    name: "Premium Heading",
    className: "premium-heading",
    previewClassName: "text-4xl font-semibold tracking-[-0.055em]",
    sample: "Premium workspace typography",
    notes: "Reserved for hero headlines and major page moments.",
  },
  {
    name: "Premium Copy",
    className: "premium-copy",
    previewClassName: "text-base leading-7",
    sample: "Calmer supporting text with contrast tuned for the dark shell.",
    notes: "Default long-form explanatory text treatment.",
  },
  {
    name: "Editorial Meta",
    className: "editorial-meta",
    previewClassName: "",
    sample: "Updated just now",
    notes: "Dense supporting metadata, labels, and object annotations.",
  },
] as const;

export const surfacePatterns = [
  {
    name: "Dashboard Frame",
    className: "dashboard-frame p-6",
    notes: "Top-level containers for page sections and hero blocks.",
  },
  {
    name: "Dashboard Rail",
    className: "dashboard-rail p-5",
    notes: "Inset supporting panels nested inside frames.",
  },
  {
    name: "Editorial Card",
    className: "editorial-card p-5",
    notes: "Repeatable object cards, rows, and summary modules.",
  },
] as const;

export const buttonGuidelines = [
  {
    label: "Primary",
    variant: "default" as const,
    description: "Use for the single most important action in a view.",
  },
  {
    label: "Secondary",
    variant: "outline" as const,
    description: "Use for alternate paths that should remain visible but restrained.",
  },
  {
    label: "Destructive",
    variant: "destructive" as const,
    description: "Use for sign out, deletion, or any irreversible action.",
  },
  {
    label: "Tertiary",
    variant: "ghost" as const,
    description: "Use for low-emphasis navigation or lightweight utility actions.",
  },
] as const;

export const statusTokens = [
  {
    name: "Dashboard Pill",
    className: "dashboard-pill",
    label: "Default",
  },
  {
    name: "Active Pill",
    className: "dashboard-pill dashboard-pill-active",
    label: "Active",
  },
  {
    name: "Editorial Chip",
    className: "editorial-chip",
    label: "Draft",
  },
  {
    name: "Live Status",
    className: "editorial-chip status-chip-live",
    label: "Published",
  },
] as const;

export const designPrinciples = [
  "Primary emphasis comes from contrast, glow, and density instead of dramatic motion.",
  "Glass surfaces should stack from `dashboard-frame` to `dashboard-rail` to `editorial-card` as detail increases.",
  "Brand lime should be used sparingly for action, active state, and editorial signal rather than full-surface fill.",
  "Destructive treatments are semantic, not decorative, and should only appear for risky or final actions.",
] as const;
