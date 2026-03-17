"use client";

import Image from "next/image";
import { UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrgUser } from "./types";

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

interface UsersListProps {
  currentUserId: string;
  users: OrgUser[];
  confirmToggle: string | null;
  togglePending: boolean;
  rolePending: boolean;
  onToggleActive: (userId: string, currentlyActive: boolean) => void;
  onCancelToggle: () => void;
  onRoleChange: (userId: string, newRole: string) => void;
}

export function UsersList({
  currentUserId,
  users,
  confirmToggle,
  togglePending,
  rolePending,
  onToggleActive,
  onCancelToggle,
  onRoleChange,
}: UsersListProps) {
  return (
    <div className="space-y-2">
      {users.map((user) => {
        const isSelf = user.id === currentUserId;
        const isConfirming = confirmToggle === user.id;

        return (
          <div
            key={user.id}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4"
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
              <select
                value={user.role}
                disabled={isSelf || rolePending}
                onChange={(e) => onRoleChange(user.id, e.target.value)}
                className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs min-h-[36px] focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>

              {!isSelf && (
                <>
                  {isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Sure?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="min-h-[36px]"
                        onClick={() => onToggleActive(user.id, user.is_active)}
                        disabled={togglePending}
                      >
                        Yes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[36px]"
                        onClick={onCancelToggle}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[36px] gap-1.5"
                      onClick={() => onToggleActive(user.id, user.is_active)}
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
  );
}
