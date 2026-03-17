"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, UserCheck, UserX, Mail, Trash2 } from "lucide-react";

type OrgUser = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  is_active: boolean;
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expires_at: string;
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function UserAvatar({ user }: { user: OrgUser }) {
  if (user.avatar_url) {
    return (
      <Image
        src={user.avatar_url}
        alt={user.name}
        width={36}
        height={36}
        className="rounded-full ring-1 ring-border"
        unoptimized
      />
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        active
          ? "bg-emerald-500/10 text-emerald-500"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 min-h-[40px] gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

export function UsersManagementClient({
  currentUserId,
  initialUsers,
  initialInvitations,
}: {
  currentUserId: string;
  initialUsers: OrgUser[];
  initialInvitations: Invitation[];
}) {
  const [tab, setTab] = useState<"users" | "invitations">("users");
  const [users, setUsers] = useState(initialUsers);
  const [invitations, setInvitations] = useState(initialInvitations);

  // Toggle active state
  const [confirmToggle, setConfirmToggle] = useState<string | null>(null);
  const [togglePending, startToggleTransition] = useTransition();

  // Role change
  const [rolePending, startRoleTransition] = useTransition();

  // Revoke invitation
  const [revokePending, startRevokeTransition] = useTransition();

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "admin" | "member">("member");
  const [inviteError, setInviteError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [invitePending, startInviteTransition] = useTransition();

  function handleToggleActive(userId: string, currentlyActive: boolean) {
    if (confirmToggle === userId) {
      // Confirmed — do it
      setConfirmToggle(null);
      startToggleTransition(async () => {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !currentlyActive }),
        });
        if (res.ok) {
          const updated = await res.json();
          setUsers((prev) =>
            prev.map((u) => (u.id === updated.id ? { ...u, is_active: updated.is_active } : u))
          );
        }
      });
    } else {
      setConfirmToggle(userId);
    }
  }

  function handleRoleChange(userId: string, newRole: string) {
    startRoleTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === updated.id ? { ...u, role: updated.role } : u))
        );
      }
    });
  }

  function handleRevoke(invitationId: string) {
    startRevokeTransition(async () => {
      const res = await fetch(`/api/admin/users/invite/${invitationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      }
    });
  }

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteLink("");

    if (!validateEmail(inviteEmail)) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    startInviteTransition(async () => {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteLink(data.invite_url);
        setInviteEmail("");
        setInviteRole("member");
        // Refresh invitations list
        const inv: Invitation = {
          id: data.id,
          email: data.email,
          role: data.role,
          expires_at: data.expires_at,
          created_at: data.created_at,
        };
        setInvitations((prev) => [inv, ...prev]);
      } else {
        setInviteError(data.error ?? "Failed to send invitation.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
        {(["users", "invitations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "users" ? `Members (${users.length})` : `Invitations (${invitations.length})`}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <div className="space-y-2">
          {users.map((user) => {
            const isSelf = user.id === currentUserId;
            const isConfirming = confirmToggle === user.id;
            return (
              <div
                key={user.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar user={user} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="truncate text-sm font-medium">{user.name}</p>
                      {isSelf && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                      <StatusBadge active={user.is_active} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Role selector */}
                  <select
                    value={user.role}
                    disabled={isSelf || rolePending}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs min-h-[36px] focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>

                  {/* Toggle active */}
                  {!isSelf && (
                    <>
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Sure?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="min-h-[36px]"
                            onClick={() => handleToggleActive(user.id, user.is_active)}
                            disabled={togglePending}
                          >
                            Yes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-[36px]"
                            onClick={() => setConfirmToggle(null)}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[36px] gap-1.5"
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                          disabled={togglePending}
                        >
                          {user.is_active ? (
                            <>
                              <UserX className="h-3.5 w-3.5" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              Activate
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invitations Tab */}
      {tab === "invitations" && (
        <div className="space-y-6">
          {/* Pending invitations list */}
          {invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <div className="space-y-2">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <p className="truncate text-sm font-medium">{inv.email}</p>
                      <span className="text-xs text-muted-foreground">
                        · {ROLE_LABELS[inv.role]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-[36px] shrink-0 gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(inv.id)}
                    disabled={revokePending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Invite form */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Invite a new member</h2>
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="invite-email" className="text-xs font-medium text-muted-foreground">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteError("");
                    setInviteLink("");
                  }}
                  placeholder="colleague@example.com"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="invite-role" className="text-xs font-medium text-muted-foreground">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "owner" | "admin" | "member")}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
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
                {invitePending ? "Sending…" : "Invite User"}
              </Button>
            </form>

            {/* Invite link after success */}
            {inviteLink && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Share this invite link:</p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 truncate rounded-lg bg-background px-3 py-2 text-xs font-mono border border-border">
                    {inviteLink}
                  </p>
                  <CopyButton text={inviteLink} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
