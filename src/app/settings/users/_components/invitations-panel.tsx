"use client";

import { Mail, Trash2 } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import type { Invitation } from "./types";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  member: "Member",
};

interface InvitationsPanelProps {
  invitations: Invitation[];
  revokePending: boolean;
  inviteEmail: string;
  inviteRole: "admin" | "member";
  inviteError: string;
  inviteLink: string;
  invitePending: boolean;
  onRevoke: (invitationId: string) => void;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (value: "admin" | "member") => void;
  onInvite: (event: React.FormEvent) => void;
}

export function InvitationsPanel({
  invitations,
  revokePending,
  inviteEmail,
  inviteRole,
  inviteError,
  inviteLink,
  invitePending,
  onRevoke,
  onInviteEmailChange,
  onInviteRoleChange,
  onInvite,
}: InvitationsPanelProps) {
  return (
    <div className="space-y-6">
      {invitations.length === 0 ? (
        <p className="dashboard-rail py-10 text-center text-sm text-muted-foreground">
          No pending invitations.
        </p>
      ) : (
        <div className="space-y-2">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="editorial-card flex items-center justify-between gap-4 p-5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <span className="text-xs text-muted-foreground">
                    · {ROLE_LABELS[invitation.role]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Expires {new Date(invitation.expires_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[36px] shrink-0 gap-1.5 text-destructive hover:text-destructive"
                onClick={() => onRevoke(invitation.id)}
                disabled={revokePending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-rail space-y-4 p-5">
        <div>
          <p className="premium-kicker text-[0.68rem]">Invite Flow</p>
          <h2 className="mt-3 text-lg font-semibold tracking-[-0.03em]">Current direct invite flow</h2>
          <p className="mt-2 text-sm leading-6 text-foreground/66">
            This is the existing platform-admin invitation path for the current
            organization. Org-admin invite requests should move into an approval flow.
          </p>
        </div>
        <form onSubmit={onInvite} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="premium-kicker text-[0.68rem]">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => onInviteEmailChange(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-role" className="premium-kicker text-[0.68rem]">
              Role
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) =>
                onInviteRoleChange(e.target.value as "admin" | "member")
              }
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {inviteError && (
            <p className="text-xs text-destructive">{inviteError}</p>
          )}

          <Button
            type="submit"
            disabled={invitePending || !inviteEmail}
            className="w-full min-h-[48px] rounded-xl sm:w-auto"
          >
            {invitePending ? "Sending..." : "Invite User"}
          </Button>
        </form>

        {inviteLink && (
          <div className="rounded-[20px] border border-border/60 bg-background/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Share this invite link:</p>
            <div className="flex items-center gap-2">
              <p className="flex-1 truncate rounded-lg bg-background px-3 py-2 text-xs font-mono border border-border">
                {inviteLink}
              </p>
              <CopyButton
                text={inviteLink}
                idleLabel="Copy link"
                copiedLabel="Copied"
                className="shrink-0 min-h-[40px] gap-1.5"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
