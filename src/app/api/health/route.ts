import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    env: {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      TOKEN_ENCRYPTION_KEY: !!process.env.TOKEN_ENCRYPTION_KEY,
      LINKEDIN_CLIENT_ID: !!process.env.LINKEDIN_CLIENT_ID,
      LINKEDIN_CLIENT_SECRET: !!process.env.LINKEDIN_CLIENT_SECRET,
    },
    node: process.version,
    timestamp: new Date().toISOString(),
  });
}
