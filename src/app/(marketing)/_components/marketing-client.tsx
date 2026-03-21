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

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <Link href="/" className={styles.navLogo}>
        <div className={styles.navBadge}>GW</div>
        <div className={styles.navWordmark}>
          Ghostwriters<span>.</span>
        </div>
      </Link>
      <div className={styles.navRight}>
        <span className={styles.navTag}>Private Beta</span>
        <Link href="/login" className={styles.navCta}>
          Join Waitlist
        </Link>
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
    const interval = setInterval(() => {
      idx++;
      track.style.transform = `translateY(-${idx * 24}px)`;
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

export function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <form className={styles.ctaForm} onSubmit={handleSubmit}>
        <input
          type="email"
          className={styles.ctaInput}
          placeholder="your@email.com"
          required
          autoComplete="email"
          disabled={submitted}
        />
        <button
          type="submit"
          className={`${styles.ctaSubmit}${submitted ? ` ${styles.done}` : ''}`}
          disabled={submitted}
        >
          {submitted ? '✓ On the list' : 'Join Waitlist'}
        </button>
      </form>
      {submitted && (
        <div className={`${styles.successLine} ${styles.show}`}>
          ✓&nbsp;&nbsp;You&#39;re on the list. We&#39;ll be in touch.
        </div>
      )}
    </>
  );
}
