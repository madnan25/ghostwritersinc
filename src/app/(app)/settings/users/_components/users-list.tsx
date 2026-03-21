"use client";

import Image from "next/image";
import { ChevronDown, Shield, Trash2, UserCheck, UserX } from "lucide-react";
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
          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border border-destructive/20 bg-destructive/10 text-destructive"
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
  confirmDelete: string | null;
  togglePending: boolean;
  rolePending: boolean;
  deletePending: boolean;
  onToggleActive: (userId: string, currentlyActive: boolean) => void;
  onCancelToggle: () => void;
  onDeleteUser: (userId: string) => void;
  onCancelDelete: () => void;
  onRoleChange: (userId: string, newRole: string) => void;
}

export function UsersList({
  currentUserId,
  users,
  confirmToggle,
  confirmDelete,
  togglePending,
  rolePending,
  deletePending,
  onToggleActive,
  onCancelToggle,
  onDeleteUser,
  onCancelDelete,
  onRoleChange,
}: UsersListProps) {
  return (
    <div className="space-y-2">
      {users.map((user) => {
        const isSelf = user.id === currentUserId;
        const isConfirming = confirmToggle === user.id;
        const isConfirmingDelete = confirmDelete === user.id;

        return (
          <div
            key={user.id}
            className="editorial-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <UserAvatar user={user} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  {isSelf && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                  {user.is_platform_admin && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Shield className="h-3 w-3" />
                      Platform Admin
                    </span>
                  )}
                  <StatusBadge active={user.is_active} />
                </div>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                {user.organization_name ? (
                  <p className="truncate text-xs text-foreground/48">{user.organization_name}</p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[148px]">
                <select
                  value={user.role}
                  disabled={isSelf || rolePending}
                  onChange={(e) => onRoleChange(user.id, e.target.value)}
                  className="h-11 w-full appearance-none rounded-full border border-border/70 bg-background/55 px-4 pr-10 text-[0.82rem] font-medium tracking-[-0.01em] text-foreground/88 shadow-[0_12px_32px_-24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-[border-color,background-color,color,box-shadow] duration-200 hover:border-primary/24 hover:bg-card/88 focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/44" />
              </div>

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
                    <>
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
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Delete?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="min-h-[36px]"
                            onClick={() => onDeleteUser(user.id)}
                            disabled={deletePending}
                          >
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-[36px]"
                            onClick={onCancelDelete}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[36px] gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => onDeleteUser(user.id)}
                          disabled={deletePending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      )}
                    </>
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
