import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ghostwriters Inc.",
  description: "LinkedIn Content Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <nav className="container flex h-14 items-center justify-between px-4">
                <div className="flex items-center gap-6">
                  <Link href="/" className="text-lg font-semibold">
                    Ghostwriters Inc.
                  </Link>
                  <div className="hidden items-center gap-4 text-sm md:flex">
                    <Link
                      href="/dashboard"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/calendar"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Calendar
                    </Link>
                    <Link
                      href="/insights"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Insights
                    </Link>
                    <Link
                      href="/team"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Team
                    </Link>
                    <Link
                      href="/research"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Research
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/settings"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Settings
                  </Link>
                  <ThemeToggle />
                </div>
              </nav>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
