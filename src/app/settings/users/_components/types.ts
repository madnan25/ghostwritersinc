export type OrgUser = {
  id: string;
  organization_id: string;
  organization_name?: string | null;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "admin" | "member";
  is_active: boolean;
  is_platform_admin: boolean;
  created_at: string;
};

export type Invitation = {
  id: string;
  organization_id: string;
  organization_name?: string | null;
  email: string;
  role: "admin" | "member";
  expires_at: string;
  created_at: string;
};

export type InviteRequestRecord = {
  id: string;
  organization_id: string;
  organization_name?: string | null;
  requested_by: string;
  requested_by_name?: string | null;
  requested_email: string;
  requested_role: "admin" | "member";
  status: "pending" | "approved" | "denied";
  decision_notes: string | null;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at: string | null;
  fulfilled_invitation_id: string | null;
  created_at: string;
  updated_at: string;
};
