import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "./crypto";

export const INVITE_COOKIE_NAME = "gw_invite";

type InviteCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
};

type CookieWriter = {
  set: (name: string, value: string, options: InviteCookieOptions) => void;
};

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function encodeInviteCookie(token: string): string {
  return encrypt(token);
}

export function decodeInviteCookie(value: string): string | null {
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

export function clearInviteCookie(
  cookies: CookieWriter
) {
  cookies.set(INVITE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function setInviteCookie(
  cookies: CookieWriter,
  token: string
) {
  cookies.set(INVITE_COOKIE_NAME, encodeInviteCookie(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });
}

type SupabaseLikeClient = SupabaseClient;

export async function getPendingInvitationByToken(
  adminClient: SupabaseLikeClient,
  token: string
) {
  const { data, error } = await adminClient
    .from("user_invitations")
    .select("id, organization_id, role, email, expires_at, accepted_at, created_at")
    .eq("token_hash", hashInviteToken(token))
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    console.error("[invitations] getPendingInvitationByToken DB error:", error.code, error.message);
    return null;
  }

  return data;
}
