#!/usr/bin/env bash
#
# sync-workspace-branches.sh
# Resets all agent workspace branches to match main.
# Handles both bare branches and worktree-checked-out branches.
#
# Usage:
#   ./scripts/sync-workspace-branches.sh          # sync all workspace branches
#   ./scripts/sync-workspace-branches.sh --dry-run # preview what would happen
#
# Designed to run:
#   - As a post-merge git hook (automatic after every merge to main)
#   - Manually after cherry-picks or direct pushes to main
#   - In CI after PRs merge

set -euo pipefail

MAIN_BRANCH="main"
DRY_RUN=false

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# Must run from repo root
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
cd "$REPO_ROOT"

MAIN_SHA="$(git rev-parse "$MAIN_BRANCH")"

echo "=== Workspace Branch Sync ==="
echo "Main is at: $(git log --oneline -1 "$MAIN_BRANCH")"
echo ""

# Find all workspace branches (pattern: *-workspace)
SYNCED=0
SKIPPED=0

for branch in $(git branch --list '*-workspace' | sed 's/^[+* ]*//' ); do
  BRANCH_SHA="$(git rev-parse "$branch")"

  if [[ "$BRANCH_SHA" == "$MAIN_SHA" ]]; then
    echo "  [ok] $branch — already at main"
    ((SKIPPED++))
    continue
  fi

  BEHIND="$(git rev-list --count "$branch".."$MAIN_BRANCH")"
  AHEAD="$(git rev-list --count "$MAIN_BRANCH".."$branch")"
  echo "  [stale] $branch — $BEHIND behind, $AHEAD ahead of main"

  if $DRY_RUN; then
    echo "         (dry-run) would reset to $MAIN_SHA"
    continue
  fi

  # Check if branch is checked out in a worktree
  WORKTREE_PATH="$(git worktree list --porcelain | awk -v b="$branch" '
    /^worktree / { wt = substr($0, 10) }
    /^branch / { if ($2 == "refs/heads/" b) print wt }
  ')"

  if [[ -n "$WORKTREE_PATH" ]]; then
    echo "         resetting via worktree at $WORKTREE_PATH"
    git -C "$WORKTREE_PATH" reset --hard "$MAIN_BRANCH"
  else
    echo "         resetting branch ref"
    git branch -f "$branch" "$MAIN_BRANCH"
  fi

  ((SYNCED++))
  echo "         -> synced to $(git log --oneline -1 "$MAIN_BRANCH")"
done

echo ""
echo "Done. Synced: $SYNCED, Already current: $SKIPPED"
