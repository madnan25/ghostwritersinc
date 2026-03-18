export type OrgUser = {
  id: string;
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
  email: string;
  role: "admin" | "member";
  expires_at: string;
  created_at: string;
};
