import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function HeaderProfileLink() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, email, avatar_url, settings")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const settings = (profile.settings ?? {}) as Record<string, unknown>;
  const linkedInProfileName = settings.linkedin_profile_name as string | null | undefined;
  const linkedInProfileAvatarUrl =
    settings.linkedin_profile_avatar_url as string | null | undefined;

  const displayName = linkedInProfileName ?? profile.name ?? user.email ?? "Profile";
  const displayAvatarUrl = linkedInProfileAvatarUrl ?? profile.avatar_url;
  const initials = displayName.trim().charAt(0).toUpperCase() || "P";

  return (
    <Link
      href="/settings"
      className="hidden items-center gap-3 rounded-full border border-border/60 bg-card/46 px-2.5 py-2 text-left text-sm transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/24 hover:bg-card/82 md:flex"
    >
      {displayAvatarUrl ? (
        <Image
          src={displayAvatarUrl}
          alt={displayName}
          width={38}
          height={38}
          unoptimized
          className="h-9 w-9 rounded-full object-cover ring-2 ring-primary/18"
        />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/12 text-xs font-semibold text-primary">
          {initials}
        </span>
      )}
      <span className="min-w-0 pr-1">
        <span className="block max-w-[8rem] truncate text-[0.82rem] font-medium tracking-[-0.02em] text-foreground/88">
          {displayName}
        </span>
        <span className="block text-[0.66rem] uppercase tracking-[0.22em] text-primary/72">
          Settings
        </span>
      </span>
    </Link>
  );
}
