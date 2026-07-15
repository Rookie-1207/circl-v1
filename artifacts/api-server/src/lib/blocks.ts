import { or, and, eq } from "drizzle-orm";
import { db, userBlocksTable } from "@workspace/db";

/**
 * Returns true if either user has blocked the other.
 * Used to enforce bidirectional block visibility across all features.
 */
export async function areUsersBlocked(userId1: number, userId2: number): Promise<boolean> {
  const [block] = await db
    .select({ id: userBlocksTable.id })
    .from(userBlocksTable)
    .where(
      or(
        and(eq(userBlocksTable.blockerId, userId1), eq(userBlocksTable.blockedId, userId2)),
        and(eq(userBlocksTable.blockerId, userId2), eq(userBlocksTable.blockedId, userId1)),
      ),
    )
    .limit(1);
  return Boolean(block);
}

/**
 * Returns the set of user IDs that are blocked in either direction relative to userId.
 * Use to bulk-filter results (e.g. discover, conversation list).
 */
export async function getBlockedUserIds(userId: number): Promise<Set<number>> {
  const blocks = await db
    .select({ blockerId: userBlocksTable.blockerId, blockedId: userBlocksTable.blockedId })
    .from(userBlocksTable)
    .where(
      or(
        eq(userBlocksTable.blockerId, userId),
        eq(userBlocksTable.blockedId, userId),
      ),
    );

  const ids = new Set<number>();
  for (const b of blocks) {
    if (b.blockerId === userId) ids.add(b.blockedId);
    else ids.add(b.blockerId);
  }
  return ids;
}
