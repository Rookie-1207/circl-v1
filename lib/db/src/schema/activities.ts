import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const activitiesTable = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    hostUserId: integer("host_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // gym | study | coffee | sports | build | gaming | movies | travel | music | badminton | running
    title: text("title").notNull(),
    location: text("location").notNull(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    maxParticipants: integer("max_participants").notNull().default(4),
    description: text("description"),
    visibility: text("visibility").notNull().default("public"), // public | connections_only
    status: text("status").notNull().default("open"), // open | full | cancelled | completed
    isIndoor: boolean("is_indoor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("activities_host_user_id_idx").on(table.hostUserId),
    index("activities_scheduled_at_idx").on(table.scheduledAt),
    index("activities_status_idx").on(table.status),
    index("activities_category_idx").on(table.category),
  ],
);

export const activityParticipantsTable = pgTable(
  "activity_participants",
  {
    id: serial("id").primaryKey(),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activitiesTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | accepted | rejected
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("activity_participants_activity_id_idx").on(table.activityId),
    index("activity_participants_user_id_idx").on(table.userId),
    // Prevent a user from joining the same activity twice (race-condition safety)
    uniqueIndex("activity_participants_activity_user_unique_idx").on(
      table.activityId,
      table.userId,
    ),
  ],
);

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertActivityParticipantSchema = createInsertSchema(
  activityParticipantsTable,
).omit({ id: true, createdAt: true });

export type Activity = typeof activitiesTable.$inferSelect;
export type ActivityParticipant = typeof activityParticipantsTable.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertActivityParticipant = z.infer<typeof insertActivityParticipantSchema>;
