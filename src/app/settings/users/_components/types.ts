export type OrgUser = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  is_active: boolean;
  created_at: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expires_at: string;
  created_at: string;
};
