"use client";

import { useState, useTransition } from "react";
import { InvitationsPanel } from "./invitations-panel";
import type { Invitation, OrgUser } from "./types";
import { UsersList } from "./users-list";

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
  const [actionError, setActionError] = useState("");

  function handleToggleActive(userId: string, currentlyActive: boolean) {
    if (confirmToggle === userId) {
      // Confirmed — do it
      setConfirmToggle(null);
      setActionError("");
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
          return;
        }

        const data = await res.json();
        setActionError(data.error ?? "Failed to update user status.");
      });
    } else {
      setConfirmToggle(userId);
    }
  }

  function handleRoleChange(userId: string, newRole: string) {
    setActionError("");
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
        return;
      }

      const data = await res.json();
      setActionError(data.error ?? "Failed to update user role.");
    });
  }

  function handleRevoke(invitationId: string) {
    setActionError("");
    startRevokeTransition(async () => {
      const res = await fetch(`/api/admin/users/invite/${invitationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        return;
      }

      const data = await res.json();
      setActionError(data.error ?? "Failed to revoke invitation.");
    });
  }

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteLink("");
    setActionError("");

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
      {actionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

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
        <UsersList
          currentUserId={currentUserId}
          users={users}
          confirmToggle={confirmToggle}
          togglePending={togglePending}
          rolePending={rolePending}
          onToggleActive={handleToggleActive}
          onCancelToggle={() => setConfirmToggle(null)}
          onRoleChange={handleRoleChange}
        />
      )}

      {/* Invitations Tab */}
      {tab === "invitations" && (
        <InvitationsPanel
          invitations={invitations}
          revokePending={revokePending}
          inviteEmail={inviteEmail}
          inviteRole={inviteRole}
          inviteError={inviteError}
          inviteLink={inviteLink}
          invitePending={invitePending}
          onRevoke={handleRevoke}
          onInviteEmailChange={(value) => {
            setInviteEmail(value);
            setInviteError("");
            setInviteLink("");
          }}
          onInviteRoleChange={setInviteRole}
          onInvite={handleInvite}
        />
      )}
    </div>
  );
}
