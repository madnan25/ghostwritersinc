'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from '../marketing.module.css';

const TICKER_ITEMS = [
  "Most agencies don't fail at delivery. They fail at expectation-setting.",
  '3 years ago I almost shut everything down. Here\'s what changed.',
  'Everyone says "build trust first." Nobody explains the actual mechanism.',
  'The best B2B founders I know share one counterintuitive habit.',
  'Your pipeline problem is not a sales problem. It\'s a clarity problem.',
  'We fired our highest-revenue client. Best business decision we made.',
  "Most agencies don't fail at delivery. They fail at expectation-setting.",
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [navTop, setNavTop] = useState(0);

  useEffect(() => {
    const NAV_H = 60;
    const handler = () => {
      setScrolled(window.scrollY > 40);
      const features = document.getElementById('features');
      if (features) {
        const bottom = features.getBoundingClientRect().bottom;
        setNavTop(bottom < NAV_H ? bottom - NAV_H : 0);
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const offScreen = navTop < 0;

  return (
    <nav
      className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}
      style={{
        top: `${navTop}px`,
        pointerEvents: offScreen ? 'none' : undefined,
      }}
    >
      <Link href="/" className={styles.navLogo}>
        <div className={styles.navBadge}>GW</div>
        <div className={styles.navWordmark}>
          Ghostwriters<span>.</span>
        </div>
      </Link>
      <div className={styles.navRight}>
        <span className={styles.navTag}>Private Beta</span>
        <button
          type="button"
          className={styles.navCta}
          onClick={() =>
            document
              .getElementById('cta')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          Join Waitlist
        </button>
      </div>
    </nav>
  );
}

export function HeroTicker() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let idx = 0;
    const total = track.children.length - 1;
    const getItemHeight = () => {
      const firstChild = track.children[0] as HTMLElement | undefined;
      return firstChild?.offsetHeight ?? 24;
    };
    const interval = setInterval(() => {
      idx++;
      const h = getItemHeight();
      track.style.transform = `translateY(-${idx * h}px)`;
      if (idx >= total) {
        setTimeout(() => {
          track.style.transition = 'none';
          track.style.transform = 'translateY(0)';
          idx = 0;
          setTimeout(() => {
            track.style.transition =
              'transform 0.55s cubic-bezier(0.4,0,0.2,1)';
          }, 60);
        }, 600);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.heroTicker}>
      <div className={styles.tickerLabel}>Live from the content pipeline</div>
      <div className={styles.tickerWindow}>
        <div className={styles.tickerTrack} ref={trackRef}>
          {TICKER_ITEMS.map((item, i) => (
            <div key={i} className={styles.tickerItem}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScrollRevealInit() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add(styles.visible);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
    );
    document
      .querySelectorAll(`.${styles.reveal}`)
      .forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}

export function ScrollToCtaButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        document.getElementById('cta')?.scrollIntoView({ behavior: 'smooth' })
      }
    >
      {children}
    </button>
  );
}

export function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          device: isMobile ? 'mobile' : 'desktop',
        }),
      });

      if (!res.ok) throw new Error('submit failed');
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className={styles.ctaForm} onSubmit={handleSubmit}>
        <input
          name="email"
          type="email"
          className={styles.ctaInput}
          placeholder="your@email.com"
          required
          autoComplete="email"
          disabled={submitted || submitting}
        />
        <button
          type="submit"
          className={`${styles.ctaSubmit}${submitted ? ` ${styles.done}` : ''}`}
          disabled={submitted || submitting}
        >
          {submitted ? '\u2713 On the list' : submitting ? 'Joining...' : 'Join Waitlist'}
        </button>
      </form>
      {submitted && (
        <div className={`${styles.successLine} ${styles.show}`}>
          {'\u2713'}&nbsp;&nbsp;You&#39;re on the list. We&#39;ll be in touch.
        </div>
      )}
      {error && (
        <div className={styles.successLine} style={{ color: '#f87171' }}>
          {error}
        </div>
      )}
    </>
  );
}
