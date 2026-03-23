"use client";

import { useSearchParams } from "next/navigation";
import { startLinkedInOAuth } from "@/lib/linkedin-oauth";
import styles from "../login.module.css";

export function LoginClient() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessage =
    error === "no_invitation"
      ? "You need an invitation to join. Contact your workspace administrator."
      : error === "invalid_invitation"
        ? "This invitation is invalid or has expired. Ask your workspace administrator for a new invite."
        : error === "invite_email_mismatch"
          ? "Sign in with the same email address that received the invitation."
          : error === "profile_load_failed"
            ? "Your session started, but your workspace profile could not be loaded. Please try again."
          : null;

  async function handleLinkedInLogin() {
    await startLinkedInOAuth("/dashboard");
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <div className={styles.kicker}>
            <span className={styles.kickerDot} />
            Private Access
          </div>
          <h1 className={styles.heading}>
            Enter the{" "}
            <span className={styles.gradientText}>editorial workspace</span>
          </h1>
          <p className={styles.subtitle}>
            Not software. An AI team — one that already knows your voice and never misses a brief.
          </p>
        </div>

        <div className={styles.card}>
          {errorMessage && (
            <div className={styles.error}>{errorMessage}</div>
          )}

          <p className={styles.infoText}>
            Continue with LinkedIn OAuth to access your organization workspace and direct your AI editorial staff.
          </p>

          <button
            type="button"
            className={styles.linkedinBtn}
            onClick={handleLinkedInLogin}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            Sign in with LinkedIn
          </button>
        </div>

        <p className={styles.footer}>
          Access is invitation-only and tailored for internal teams managing executive content.
        </p>
      </div>
    </div>
  );
}
