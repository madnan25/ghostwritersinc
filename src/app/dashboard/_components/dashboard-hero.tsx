"use client";

import { m } from "framer-motion";
import {
  DASHBOARD_METRIC_CARDS,
  type DashboardMetrics,
} from "@/lib/dashboard-ui";
import { RequestPostButton } from "./request-post-dialog";

type DashboardHeroProps = {
  metrics: DashboardMetrics;
  narrative: string;
};

function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="dashboard-rail rounded-[22px] p-5">
      <p className="premium-kicker text-[0.62rem]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm text-foreground/66">{detail}</p>
    </div>
  );
}

export function DashboardHero({ metrics, narrative }: DashboardHeroProps) {
  return (
    <section>
      <div className="dashboard-frame relative overflow-hidden p-7 sm:p-8 lg:p-10">
        <m.div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(155,255,82,0.16)_0%,rgba(255,255,255,0.04)_45%,transparent_72%)] blur-3xl"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45 }}
        />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)] lg:items-end">
          <div className="max-w-4xl">
            <p className="premium-kicker">Editorial System</p>
            <h1 className="mt-4 max-w-none text-[clamp(2.35rem,4.6vw,3.55rem)] font-semibold tracking-[-0.06em] leading-[1.02] text-foreground">
              <span className="block whitespace-normal lg:whitespace-nowrap">
                Content at the speed of thought.
              </span>
              <span className="block whitespace-normal lg:whitespace-nowrap">
                Staffed by agents, run by you.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-foreground/70">
              {narrative}
            </p>
            <div className="mt-6">
              <RequestPostButton />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {DASHBOARD_METRIC_CARDS.map((card) => (
              <MetricCard
                key={card.key}
                label={card.label}
                value={metrics[card.key]}
                detail={card.detail}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
