#!/bin/bash
# LIN-131: User Management UI — commit script
# Run from /Users/mdadnan/ghostwritersinc

set -e
cd "$(dirname "$0")"

pnpm lint --max-warnings 0 && pnpm build || { echo "Build/lint failed — fix errors before committing"; exit 1; }

git add \
  src/app/settings/users/page.tsx \
  src/app/settings/users/_components/users-management-client.tsx \
  src/app/auth/invite/page.tsx \
  src/app/auth/invite/_components/invite-page-client.tsx \
  src/app/login/page.tsx \
  src/app/login/_components/login-client.tsx \
  src/app/settings/page.tsx

git commit -m "feat: user management UI — /settings/users, invite page, login error handling (LIN-131)

- Add /settings/users page with tabbed UI: members table + invitations + invite form
- Members tab: role selector, active/inactive toggle with confirmation, status badges
- Invitations tab: list pending invites with revoke, invite form with copy-link on success
- Add /auth/invite page: validates token via API, shows org name + LinkedIn sign-in
- Update /login to show error banner for ?error=no_invitation
- Add 'Manage Users' link in /settings for owner role

Co-Authored-By: Paperclip <noreply@paperclip.ing>"

echo "Done. Push with: git push origin main"
