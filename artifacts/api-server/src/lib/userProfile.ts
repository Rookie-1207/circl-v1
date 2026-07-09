import type { usersTable } from "@workspace/db";

type UserRow = typeof usersTable.$inferSelect;

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function getProfileCompletion(user: UserRow): number {
  const checks = [
    hasText(user.name),
    hasText(user.university),
    hasText(user.bio),
    hasText(user.department),
    hasText(user.year),
    hasText(user.section),
    hasText(user.studentType),
    hasText(user.githubUrl),
    hasText(user.linkedinUrl),
    hasText(user.avatarUrl),
    user.interests.length > 0,
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export function formatUserProfile(user: UserRow) {
  return {
    ...user,
    bio: user.bio ?? null,
    department: user.department ?? null,
    year: user.year ?? null,
    section: user.section ?? null,
    studentType: user.studentType ?? null,
    githubUrl: user.githubUrl ?? null,
    linkedinUrl: user.linkedinUrl ?? null,
    goals: user.goals ?? null,
    avatarUrl: user.avatarUrl ?? null,
    profileCompletion: getProfileCompletion(user),
    createdAt: user.createdAt.toISOString(),
  };
}
