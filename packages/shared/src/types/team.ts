/**
 * @module team
 *
 * Composite / enriched team types used throughout the application layer.
 * These extend the raw database row types with member lists and profile data.
 */

import type { Team, TeamMember, Profile, TeamRole } from './database.js';

/**
 * A team enriched with its full member list and member count.
 *
 * @remarks Used in team settings and management views.
 */
export interface TeamWithMembers extends Team {
  /** List of team members with their profile information. */
  members: TeamMemberWithProfile[];

  /** Total number of members in the team. */
  member_count: number;
}

/**
 * A team member with their associated user profile resolved.
 *
 * @remarks Used when displaying member lists with avatars and names.
 */
export interface TeamMemberWithProfile extends TeamMember {
  /** The member's profile information. */
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'email'>;
}

/**
 * Lightweight team representation for navigation and team-switcher UIs.
 *
 * @remarks Contains only the fields needed for list rendering and role-based UI gating.
 */
export interface TeamListItem {
  /** Unique team identifier. */
  id: string;

  /** Human-readable team name. */
  name: string;

  /** URL-safe team slug. */
  slug: string;

  /** The current user's role within this team. */
  user_role: TeamRole;

  /** Total number of members in the team. */
  member_count: number;
}
