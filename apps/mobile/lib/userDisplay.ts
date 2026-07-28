interface UserProfile {
  display_name?: string | null;
  email?: string | null;
  user_metadata?: { display_name?: string | null };
}

export function getDisplayName(user: UserProfile | null | undefined, fallback = 'Unbekannt'): string {
  if (!user) return fallback;
  return user.display_name || user.user_metadata?.display_name || fallback;
}

export function getInitials(user: UserProfile | null | undefined, fallback = 'UN'): string {
  const name = getDisplayName(user, '');
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return fallback;
}
