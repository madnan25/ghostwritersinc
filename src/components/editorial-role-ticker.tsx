"use client";

import { AnimatePresence, m } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ROLES = [
  {
    title: "Content Strategist",
    description: "Sets the themes, cadence, and narrative direction for the week — so every post lands with purpose, not coincidence.",
  },
  {
    title: "LinkedIn Ghostwriter",
    description: "Turns signals, observations, and raw thinking into posts that sound unmistakably like the principal. Not the platform.",
  },
  {
    title: "Research Analyst",
    description: "Surfaces proof points, contrarian angles, and timely examples — the kind of material that makes a draft worth reading.",
  },
  {
    title: "Editorial Reviewer",
    description: "Cuts drag, sharpens structure, and catches what blurs the point. Every draft leaves cleaner than it arrived.",
  },
  {
    title: "Brand Voice Editor",
    description: "Holds the line on tone, language, and distinctiveness — across every post, every revision, every agent in the loop.",
  },
  {
    title: "Publishing Operator",
    description: "Moves work from draft to reviewed to scheduled without losing anything in handoff. The queue stays alive and honest.",
  },
];

export function EditorialRoleTicker() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRole = ROLES[activeIndex];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % ROLES.length);
    }, 6800);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative max-w-4xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[12%] top-14 h-28 rounded-full bg-[radial-gradient(circle,rgba(136,255,86,0.14)_0%,rgba(252,238,33,0.07)_42%,transparent_74%)] blur-3xl"
      />
      <m.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-6 top-10 h-40 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 30% 50%, rgba(136,255,86,0.10) 0%, transparent 55%), radial-gradient(circle at 70% 40%, rgba(252,238,33,0.06) 0%, transparent 60%)",
          filter: "blur(18px)",
        }}
        animate={{ x: [-10, 14, -10], y: [0, -6, 0], opacity: [0.38, 0.62, 0.38] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="mb-4">
        <p className="max-w-2xl text-[clamp(1.05rem,1.55vw,1.45rem)] font-semibold tracking-[-0.04em] text-foreground">
          Full-time editorial roles, directed by you.
        </p>
      </div>

      <div className="relative grid gap-5 lg:grid-cols-[minmax(190px,0.84fr)_minmax(0,1.16fr)] lg:items-center">
        <div className="space-y-1">
          {ROLES.map((role, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={role.title}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                className={cn(
                  "group relative block w-full rounded-[16px] px-3.5 py-2 text-left transition-colors duration-300",
                  isActive ? "bg-background/26" : "hover:bg-background/14",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-all duration-300",
                      isActive ? "bg-primary shadow-[0_0_14px_rgba(136,255,86,0.55)]" : "bg-foreground/18",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[0.88rem] tracking-[0.01em] transition-colors duration-300",
                      isActive ? "text-foreground" : "text-foreground/52",
                    )}
                  >
                    {role.title}
                  </span>
                </div>
                {isActive ? (
                  <m.div
                    layoutId="active-role-rule"
                    className="absolute inset-y-2 left-0 w-px rounded-full bg-gradient-to-b from-transparent via-primary to-transparent"
                    transition={{ type: "spring", stiffness: 120, damping: 20, mass: 0.9 }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="relative min-h-[130px]">
          <m.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-4 left-0 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent"
            animate={{ opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />

          <AnimatePresence mode="wait">
            <m.div
              key={activeRole.title}
              initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              className="pl-6 sm:pl-7"
            >
              <p
                className="text-[clamp(1rem,1.45vw,1.35rem)] leading-[1.65] tracking-[-0.015em] text-foreground/78"
                style={{ fontStyle: "italic" }}
              >
                {activeRole.description}
              </p>
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
