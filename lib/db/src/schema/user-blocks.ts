import { pgTable, serial, timestamp, integer, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userBlocksTable = pgTable(
  "user_blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: integer("blocker_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    blockedId: integer("blocked_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_blocks_blocker_id_idx").on(table.blockerId),
    index("user_blocks_blocked_id_idx").on(table.blockedId),
    unique("user_blocks_pair_unique").on(table.blockerId, table.blockedId),
  ],
);

export const insertUserBlockSchema = createInsertSchema(userBlocksTable).omit({ id: true, createdAt: true });
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;
export type UserBlock = typeof userBlocksTable.$inferSelect;
