import Link from 'next/link';
import { Suspense } from 'react';
import { BrandWordmark } from '@/components/brand-wordmark';
import { HeaderProfileLink } from '@/components/header-profile-link';
import {
  NotificationBellFallback,
  NotificationBellWrapper,
} from '@/components/notification-bell-wrapper';
import { MobileNav } from '@/components/mobile-nav';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="premium-shell flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border/55 bg-background/62 backdrop-blur-xl">
        <nav className="container flex h-20 items-center justify-between gap-6 px-4 md:px-6">
          <div className="flex items-center gap-8">
            <BrandWordmark compact />
            <div className="hidden items-center gap-0.5 rounded-full border border-border/60 bg-card/52 p-1 text-[0.82rem] font-medium tracking-[-0.01em] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.55)] md:flex">
              {[
                { href: '/dashboard', label: 'Dashboard' },
                { href: '/calendar', label: 'Calendar' },
                { href: '/briefs', label: 'Briefs' },
                { href: '/insights', label: 'Insights' },
                { href: '/team', label: 'Team' },
                { href: '/strategy', label: 'Strategy' },
                { href: '/series', label: 'Series' },
                { href: '/research', label: 'Research' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-full px-4 py-2 text-foreground/72 transition-all duration-150 hover:bg-card/88 hover:text-foreground"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HeaderProfileLink />
            <Suspense fallback={<NotificationBellFallback />}>
              <NotificationBellWrapper />
            </Suspense>
          </div>
        </nav>
      </header>
      <main className="relative z-10 flex-1 pb-24 md:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
