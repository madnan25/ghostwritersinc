import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  buttonGuidelines,
  designPrinciples,
  formControls,
  foundationTokens,
  statusTokens,
  surfacePatterns,
  typographyStyles,
} from "./design-system-data";

function DesignSection({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <p className="premium-kicker text-[0.68rem]">{kicker}</p>
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">{title}</h2>
        <p className="max-w-3xl text-sm leading-7 text-foreground/66">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function DesignSystemShowcase() {
  return (
    <div className="space-y-10">
      <DesignSection
        kicker="Foundations"
        title="Color Tokens"
        description="These tokens define the premium dark shell, lime accent, and restrained danger treatment used throughout the product."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {foundationTokens.map((token) => (
            <div key={token.name} className="editorial-card p-4">
              <div
                className="flex h-24 items-end rounded-[20px] border border-border/60 p-4"
                style={{
                  backgroundColor: `var(${token.cssVar})`,
                  color: `var(${token.textVar})`,
                }}
              >
                <span className="text-sm font-medium">{token.name}</span>
              </div>
              <div className="mt-4 space-y-1.5">
                <p className="font-mono text-[0.72rem] text-foreground/52">{token.cssVar}</p>
                <p className="text-sm leading-6 text-foreground/68">{token.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </DesignSection>

      <DesignSection
        kicker="Typography"
        title="Fonts And Type System"
        description="The product uses a restrained font stack and a small set of text utilities to keep the interface editorial, clear, and consistent."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {typographyStyles.map((style) => (
            <div key={style.name} className="dashboard-rail p-5">
              <p className="editorial-meta">{style.name}</p>
              <div className="mt-4">
                <p className={cn(style.className, style.previewClassName)}>{style.sample}</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-foreground/68">{style.notes}</p>
            </div>
          ))}
        </div>
      </DesignSection>

      <DesignSection
        kicker="Surfaces"
        title="Layout And Object Patterns"
        description="These reusable surface layers form the visual hierarchy of the application and should be preferred over ad hoc panel styling."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {surfacePatterns.map((pattern) => (
            <div key={pattern.name} className={pattern.className}>
              <p className="premium-kicker text-[0.64rem]">{pattern.name}</p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-foreground">
                Reusable premium surface
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-7 text-foreground/68">
                {pattern.notes}
              </p>
            </div>
          ))}
        </div>
      </DesignSection>

      <DesignSection
        kicker="Actions"
        title="Button Semantics"
        description="Buttons should communicate hierarchy semantically first. The shared variants are the source of truth for emphasis and behavior."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {buttonGuidelines.map((button) => (
            <div key={button.label} className="dashboard-rail p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant={button.variant}>{button.label}</Button>
                <Button variant={button.variant} disabled>
                  Disabled
                </Button>
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">{button.label}</p>
              <p className="mt-1 text-sm leading-6 text-foreground/68">{button.description}</p>
            </div>
          ))}
        </div>
      </DesignSection>

      <DesignSection
        kicker="Signals"
        title="Status Language"
        description="Pills and chips should be used to express editorial state without introducing extra color systems or one-off badges."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statusTokens.map((token) => (
            <div key={token.name} className="editorial-card p-5">
              <p className="editorial-meta">{token.name}</p>
              <div className="mt-4">
                <span className={token.className}>{token.label}</span>
              </div>
            </div>
          ))}
        </div>
      </DesignSection>

      <DesignSection
        kicker="Form Controls"
        title="Input Patterns"
        description="Standardized form controls for filters, selectors, and compact inputs used across dashboard panels."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {formControls.map((control) => (
            <div key={control.name} className="dashboard-rail p-5">
              <p className="editorial-meta">{control.name}</p>
              <div className="mt-4">
                <select
                  className={control.className}
                  style={control.chevronStyle}
                  defaultValue={control.sampleOptions[0]}
                >
                  {control.sampleOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-4 text-sm leading-6 text-foreground/68">
                {control.notes}
              </p>
              <p className="mt-2 text-xs leading-5 text-foreground/50">
                {control.usage}
              </p>
            </div>
          ))}
        </div>
      </DesignSection>

      <DesignSection
        kicker="Principles"
        title="Usage Guidelines"
        description="These are the rules to follow when extending the interface so the product keeps a coherent premium feel."
      >
        <div className="dashboard-frame p-6 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2">
            {designPrinciples.map((principle) => (
              <div key={principle} className="dashboard-rail p-5">
                <p className="text-sm leading-7 text-foreground/72">{principle}</p>
              </div>
            ))}
          </div>
        </div>
      </DesignSection>
    </div>
  );
}
