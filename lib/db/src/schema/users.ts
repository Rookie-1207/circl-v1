import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  supabaseUserId: text("supabase_user_id").unique(),
  name: text("name").notNull(),
  university: text("university").notNull(),
  bio: text("bio"),
  department: text("department"),
  year: text("year"),
  section: text("section"),
  studentType: text("student_type"),
  githubUrl: text("github_url"),
  linkedinUrl: text("linkedin_url"),
  interests: text("interests").array().notNull().default([]),
  lookingFor: text("looking_for").array().notNull().default([]),
  availability: text("availability").array().notNull().default([]),
  goals: text("goals"),
  avatarUrl: text("avatar_url"),
  isOnline: boolean("is_online").notNull().default(false),
  // Soft delete — set when account is marked for deletion
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  // Permanent deletion scheduled 30 days after soft-delete
  scheduledDeletionAt: timestamp("scheduled_deletion_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
