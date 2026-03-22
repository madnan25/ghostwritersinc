import {
  HeroTicker,
  MarketingNav,
  ScrollRevealInit,
  WaitlistForm,
} from './_components/marketing-client';
import styles from './marketing.module.css';

export const metadata = {
  title: 'Ghostwriters Inc. — Your LinkedIn, on Autopilot',
  description:
    'A coordinated team of AI agents that researches, strategizes, writes, and publishes your LinkedIn content — on autopilot, in your voice.',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover',
  },
};

export default function MarketingPage() {
  return (
    <div className={styles.wrapper}>
      <MarketingNav />

      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroKicker}>
            <div className={styles.heroKickerDot} />
            <span className={styles.heroKickerLabel}>
              Now accepting founding members
            </span>
          </div>

          <h1 className={styles.heroH1}>
            Your LinkedIn.<br />
            Written by <span className={styles.lime}>agents.</span><br />
            <span className={styles.dim}>Sounding like you.</span>
          </h1>

          <p className={styles.heroSub}>
            A coordinated team of AI agents that researches, strategizes,
            writes, and publishes your LinkedIn content — on autopilot, in your
            voice, getting sharper every week.
          </p>

          <div className={styles.heroActions}>
            <a href="#cta" className={styles.btnLg}>
              Request Early Access
            </a>
            <span className={styles.heroAside}>
              Founding cohort only · Limited spots
            </span>
          </div>

          <HeroTicker />
          <div className={styles.heroWmMobile} aria-hidden="true">
            <span>GWI</span>
          </div>
        </div>
        <div className={styles.heroWm}>GWI</div>
      </section>

      <div className={styles.divider} />

      {/* PROBLEM */}
      <section className={styles.problem}>
        <div className={styles.reveal}>
          <div className={styles.kicker}>The problem</div>
          <h2 className={styles.problemH2}>
            You know LinkedIn matters.<br />
            <span className={styles.muted}>You just never post.</span>
          </h2>
          <p className={styles.problemBody}>
            LinkedIn has 1 billion users. Only 1% of them post content
            regularly — yet that 1% captures the vast majority of views,
            inbound opportunities, and trust.
            <br /><br />
            The founders with the sharpest ideas, the most hard-won experience,
            the most useful perspectives? Silent. Not because they have nothing
            to say. Because writing consistently takes more time than they have.
          </p>
        </div>
        <div className={`${styles.statsCard} ${styles.reveal}`}>
          <div className={styles.stat}>
            <div className={styles.statN}>1%</div>
            <div className={styles.statL}>
              of LinkedIn&apos;s 1 billion users post regularly — they generate
              virtually all the organic reach on the platform
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statN}>5.9×</div>
            <div className={styles.statL}>
              more pipeline generated per dollar by content-led inbound vs
              outbound, per HubSpot&apos;s State of Marketing report
            </div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statN}>3hrs</div>
            <div className={styles.statL}>
              median time founders report spending per LinkedIn post —
              research, drafting, editing, second-guessing, rewriting
            </div>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* PIPELINE */}
      <section className={styles.pipeline}>
        <div className={`${styles.pipelineHdr} ${styles.reveal}`}>
          <h2 className={styles.pipelineTitle}>The content pipeline</h2>
          <span className={styles.kicker} style={{ margin: 0 }}>
            How it works
          </span>
        </div>
        <div className={`${styles.steps} ${styles.reveal}`}>
          <div className={styles.step}>
            <span className={styles.stepN}>01</span>
            <span className={styles.stepAgent}>Scout</span>
            <div className={styles.stepTitle}>Research</div>
            <div className={styles.stepBody}>
              Monitors sources, scores signals 0–1.0, populates the research
              pool. Runs every 4 hours.
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepN}>02</span>
            <span className={styles.stepAgent}>Strategist</span>
            <div className={styles.stepTitle}>Plan</div>
            <div className={styles.stepBody}>
              Turns research into briefs. Selects pillar, angle, hook
              direction. Manages the editorial calendar.
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepN}>03</span>
            <span className={styles.stepAgent}>Scribe</span>
            <div className={styles.stepTitle}>Write</div>
            <div className={styles.stepBody}>
              Drafts posts in your voice across 6 templates. Learns from every
              approved draft. Gets sharper weekly.
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepN}>04</span>
            <span className={styles.stepAgent}>You</span>
            <div className={styles.stepTitle}>Review</div>
            <div className={styles.stepBody}>
              Approve, revise inline, or reject. Targeted section edits. Full
              version history. Under 2 minutes.
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepN}>05</span>
            <span className={styles.stepAgent}>Platform</span>
            <div className={styles.stepTitle}>Publish</div>
            <div className={styles.stepBody}>
              Direct publish to LinkedIn or one-click copy. Scheduled or
              immediate. Tracked and logged.
            </div>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* AGENTS */}
      <section className={styles.agents}>
        <div className={styles.agentsHdr}>
          <div className={styles.reveal}>
            <div className={`${styles.kicker} ${styles.lime}`}>The team</div>
            <h2 className={styles.agentsH2}>
              Not a tool.<br />A team of <em>agents</em><br />working for you.
            </h2>
          </div>
          <p className={`${styles.agentsBody} ${styles.reveal}`}>
            Ghostwriters Inc. is structured like a real company — with a CEO,
            PM, content strategists, researchers, writers, engineers, QA, and
            security. Every agent has a defined role, a reporting structure,
            and a single mandate: produce content that builds your authority.
          </p>
        </div>
        <div className={`${styles.agentsGrid} ${styles.reveal}`}>
          {[
            { role: 'CEO', name: 'Rainmaker', desc: 'Strategic decisions, resource allocation, and team coordination across the whole operation.' },
            { role: 'Content Strategist', name: 'Strategist', desc: 'Plans briefs, manages the editorial calendar, defines angles. Heartbeat every 8 hours.' },
            { role: 'Research Analyst', name: 'Scout', desc: 'Monitors sources, scores signals 0–1.0, populates the research pool. Every 4 hours.' },
            { role: 'Content Writer', name: 'Scribe', desc: 'Writes posts across 6 formats. Learns your voice from every approved and edited draft.' },
            { role: 'Product Manager', name: 'Navigator', desc: 'Manages the web app product — feature prioritization, backlog, cross-team coordination.' },
            { role: 'Head of Engineering', name: 'Craftsman', desc: 'Owns the technical infrastructure. Leads Builder and Fixer on all web app work.' },
            { role: 'QA Engineer', name: 'Inspector', desc: 'Tests every release. End-to-end flows, API testing, regression prevention before deploy.' },
            { role: 'Security Engineer', name: 'Sentinel', desc: 'Audits for key exposure, RLS policies, OWASP compliance. Always watching.' },
          ].map(({ role, name, desc }) => (
            <div key={name} className={styles.agent}>
              <div className={styles.agentRole}>{role}</div>
              <div className={styles.agentName}>{name}</div>
              <div className={styles.agentDesc}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PULLQUOTE */}
      <section className={styles.pullquote}>
        <div className={`${styles.pqInner} ${styles.reveal}`}>
          <p className={styles.pqText}>
            The best ghostwriter isn&apos;t the one who sounds most like you on
            day one.<br />
            It&apos;s the one who sounds most like you on day <em>ninety</em>.
          </p>
          <div className={styles.pqAttr}>The Ghostwriters Inc. Philosophy</div>
        </div>
      </section>

      {/* PILLARS */}
      <section className={styles.pillars}>
        <div className={`${styles.pillarsHdr} ${styles.reveal}`}>
          <div>
            <div className={styles.kicker}>Content Strategy</div>
            <h2 className={styles.pillarsH2}>
              Five pillars.<br />One authoritative voice.
            </h2>
          </div>
          <p className={styles.pillarsSub}>
            Every post maps to one of five content pillars — calibrated to your
            audience, ICP, and what drives inbound trust. You control the
            weighting. The agents handle the execution.
          </p>
        </div>
        <div className={styles.reveal}>
          {[
            { n: '01', name: 'Industry Insights & Trends', desc: 'Data-backed observations, emerging patterns, what no one else is saying yet', tag: 'Credibility' },
            { n: '02', name: 'Founder & Operator Lessons', desc: 'First-person stories, decision frameworks, honest mistake breakdowns', tag: 'Relatability' },
            { n: '03', name: 'Tactical How-Tos', desc: 'Step-by-step guides, frameworks, and checklists your audience can act on', tag: 'Utility' },
            { n: '04', name: 'Contrarian & Perspective Pieces', desc: 'Challenging conventional wisdom with a reasoned, well-argued position', tag: 'Authority' },
            { n: '05', name: 'Client Results & Case Studies', desc: 'Anonymized or named outcomes, before/after, real numbers that prove the work', tag: 'Proof' },
          ].map(({ n, name, desc, tag }) => (
            <div key={n} className={styles.pillarRow}>
              <span className={styles.pillarN}>{n}</span>
              <div>
                <div className={styles.pillarName}>{name}</div>
                <div className={styles.pillarDesc}>{desc}</div>
              </div>
              <span className={styles.pillarTag}>{tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className={styles.features}>
        <div className={`${styles.featuresHdr} ${styles.reveal}`}>
          <h2 className={styles.featuresH2}>
            Built for humans who care about quality
          </h2>
          <span className={styles.kicker} style={{ margin: 0 }}>
            The control layer
          </span>
        </div>
        <div className={`${styles.featuresGrid} ${styles.reveal}`}>
          {[
            { kicker: '01 — Review', title: 'Inline Targeted Revision', body: 'Highlight any section and leave a note. Scribe rewrites only what you flagged — nothing else changes. Real collaboration, not full rejects.' },
            { kicker: '02 — Voice', title: 'Adaptive Voice Learning', body: 'Every edit you make is a signal. The system diffs approved drafts against originals and updates the voice profile. Gets sharper every week.' },
            { kicker: '03 — Intent', title: 'Human Post Requests', body: 'Have something specific to say? Submit a request — topic, angle, target week — and the agents handle the rest. Your intent, their execution.' },
            { kicker: '04 — Strategy', title: 'Pillar Weight Control', body: "Doing a raise? Launching a service? Shift your content mix for the month. The agents recalibrate their planning accordingly." },
            { kicker: '05 — Narrative', title: 'Content Series Management', body: 'Plan multi-post series with a defined arc. Scribe writes each part with full context of what came before. A presence that feels authored.' },
            { kicker: '06 — Intelligence', title: 'Scout Context Injection', body: 'Leave standing instructions for Scout across research cycles. The research pool starts reflecting your actual positioning.' },
          ].map(({ kicker, title, body }) => (
            <div key={kicker} className={styles.feat}>
              <div className={styles.featKicker}>{kicker}</div>
              <div className={styles.featTitle}>{title}</div>
              <div className={styles.featBody}>{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta} id="cta">
        <div className={`${styles.ctaKicker} ${styles.reveal}`}>
          Private Beta — Founding Access
        </div>
        <h2 className={`${styles.ctaH2} ${styles.reveal}`}>
          Your LinkedIn.<br />Finally <em>working</em>.
        </h2>
        <WaitlistForm />
        <p className={styles.ctaFine}>
          No pitch decks. No demo calls. Early access when we&apos;re ready.
        </p>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <div className={styles.footerBadge}>GW</div>
          <span className={styles.footerName}>Ghostwriters Inc.</span>
        </div>
        <span className={styles.footerCopy}>
          © 2026 Ghostwriters Inc. · All rights reserved
        </span>
      </footer>

      <ScrollRevealInit />
    </div>
  );
}
