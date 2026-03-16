"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="container flex flex-col items-center justify-center gap-8 px-4 py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Ghostwriters Inc.
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Your LinkedIn content management platform. Review, approve, and
          publish AI-generated content in minutes.
        </p>
      </div>
      <div className="flex gap-4">
        <Button size="lg" render={<Link href="/login" />}>
          Get Started
        </Button>
        <Button variant="outline" size="lg" render={<Link href="/dashboard" />}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}
