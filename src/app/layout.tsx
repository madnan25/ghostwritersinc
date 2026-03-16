import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
                  <a href="/" className="text-lg font-semibold">
                    Ghostwriters Inc.
                  </a>
                  <div className="hidden items-center gap-4 text-sm md:flex">
                    <a
                      href="/dashboard"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Dashboard
                    </a>
                    <a
                      href="/calendar"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Calendar
                    </a>
                    <a
                      href="/insights"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Insights
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
