import { pgTable, serial, timestamp, integer, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const conversationsTable = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    user1Id: integer("user1_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    user2Id: integer("user2_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    // Indexes for the two hottest query paths (chat list + conversation lookup)
    index("conversations_user1_id_idx").on(table.user1Id),
    index("conversations_user2_id_idx").on(table.user2Id),
    // Prevent duplicate conversations between the same pair of users
    unique("conversations_user_pair_unique").on(table.user1Id, table.user2Id),
  ],
);

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversationsTable.$inferSelect;
