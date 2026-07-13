import { Router, type IRouter } from "express";
import { eq, and, or, desc, gte, lte, inArray } from "drizzle-orm";
import {
  db,
  activitiesTable,
  activityParticipantsTable,
  usersTable,
  connectionsTable,
} from "@workspace/db";
import { z } from "zod";
import { formatUserProfile } from "../lib/userProfile";

const router: IRouter = Router();

// ─── Validation schemas ───────────────────────────────────────────────────────

const CreateActivitySchema = z.object({
  category: z.string().trim().min(1).max(40),
  title: z.string().trim().min(2).max(120),
  location: z.string().trim().min(1).max(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  scheduledAt: z.string().datetime(),
  maxParticipants: z.number().int().min(2).max(50).default(4),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(["public", "connections_only"]).default("public"),
  isIndoor: z.boolean().optional(),
});

const ListActivitiesSchema = z.object({
  category: z.string().optional(),
  date: z.enum(["today", "tomorrow", "week"]).optional(),
  hasSpots: z.coerce.boolean().optional(),
  isIndoor: z.coerce.boolean().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatActivity(
  activity: typeof activitiesTable.$inferSelect,
  host: ReturnType<typeof formatUserProfile>,
  participantCount: number,
  userParticipantStatus: string | null,
  distanceKm: number | null,
) {
  return {
    id: activity.id,
    category: activity.category,
    title: activity.title,
    location: activity.location,
    latitude: activity.latitude ?? null,
    longitude: activity.longitude ?? null,
    scheduledAt: activity.scheduledAt.toISOString(),
    maxParticipants: activity.maxParticipants,
    participantCount,
    description: activity.description ?? null,
    visibility: activity.visibility,
    status: activity.status,
    isIndoor: activity.isIndoor ?? null,
    host,
    distanceKm,
    userParticipantStatus,
    createdAt: activity.createdAt.toISOString(),
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /activities
router.get("/activities", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const query = ListActivitiesSchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { category, date, hasSpots, isIndoor, lat, lng } = query.data;

  // Build date range filter
  const now = new Date();
  let fromDate = now;
  let toDate: Date | null = null;

  if (date === "today") {
    toDate = new Date(now);
    toDate.setHours(23, 59, 59, 999);
  } else if (date === "tomorrow") {
    fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() + 1);
    fromDate.setHours(0, 0, 0, 0);
    toDate = new Date(fromDate);
    toDate.setHours(23, 59, 59, 999);
  } else if (date === "week") {
    toDate = new Date(now);
    toDate.setDate(toDate.getDate() + 7);
    toDate.setHours(23, 59, 59, 999);
  }

  const conditions = [
    gte(activitiesTable.scheduledAt, fromDate),
    eq(activitiesTable.status, "open"),
    ...(toDate ? [lte(activitiesTable.scheduledAt, toDate)] : []),
    ...(category
      ? [eq(activitiesTable.category, category.toLowerCase())]
      : []),
    ...(isIndoor !== undefined
      ? [eq(activitiesTable.isIndoor, isIndoor)]
      : []),
  ];

  const activities = await db
    .select()
    .from(activitiesTable)
    .where(and(...conditions))
    .orderBy(desc(activitiesTable.createdAt))
    .limit(200); // safety cap — prevent unbounded scans at scale

  if (activities.length === 0) {
    res.json([]);
    return;
  }

  const hostIds = [...new Set(activities.map((a) => a.hostUserId))];

  // Resolve accepted connections for visibility enforcement (connections_only activities)
  const acceptedConnections = await db
    .select({ fromUserId: connectionsTable.fromUserId, toUserId: connectionsTable.toUserId })
    .from(connectionsTable)
    .where(
      and(
        or(
          eq(connectionsTable.fromUserId, currentUserId),
          eq(connectionsTable.toUserId, currentUserId)
        ),
        eq(connectionsTable.status, "accepted")
      )
    );

  const connectedUserIds = new Set<number>([currentUserId]);
  for (const c of acceptedConnections) {
    connectedUserIds.add(c.fromUserId === currentUserId ? c.toUserId : c.fromUserId);
  }

  // Fetch hosts
  const hosts = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, hostIds));
  const hostMap = new Map(hosts.map((h) => [h.id, h]));

  // Fetch participant counts + current user status
  const activityIds = activities.map((a) => a.id);
  const participants = await db
    .select()
    .from(activityParticipantsTable)
    .where(inArray(activityParticipantsTable.activityId, activityIds));

  const acceptedCountMap = new Map<number, number>();
  const userStatusMap = new Map<number, string>();
  for (const p of participants) {
    if (p.status === "accepted") {
      acceptedCountMap.set(
        p.activityId,
        (acceptedCountMap.get(p.activityId) ?? 0) + 1,
      );
    }
    if (p.userId === currentUserId) {
      userStatusMap.set(p.activityId, p.status);
    }
  }

  let results = activities.map((a) => {
    const host = hostMap.get(a.hostUserId);
    const participantCount = acceptedCountMap.get(a.id) ?? 0;

    // Distance
    let distanceKm: number | null = null;
    if (lat !== undefined && lng !== undefined && a.latitude && a.longitude) {
      distanceKm =
        Math.round(haversineKm(lat, lng, a.latitude, a.longitude) * 10) / 10;
    }

    return {
      ...formatActivity(
        a,
        formatUserProfile(host!),
        participantCount,
        userStatusMap.get(a.id) ?? null,
        distanceKm,
      ),
      _scheduledAt: a.scheduledAt,
      _distance: distanceKm,
    };
  });

  // Enforce visibility: hide connections_only activities from non-connected users
  results = results.filter(
    (r) => r.visibility === "public" || connectedUserIds.has(r.host?.id ?? -1),
  );

  // Filter open spots
  if (hasSpots) {
    results = results.filter(
      (r) => r.participantCount < r.maxParticipants,
    );
  }

  // Sort: by distance if coords provided, else by scheduledAt
  if (lat !== undefined && lng !== undefined) {
    results.sort(
      (a, b) => (a._distance ?? Infinity) - (b._distance ?? Infinity),
    );
  } else {
    results.sort(
      (a, b) =>
        a._scheduledAt.getTime() - b._scheduledAt.getTime(),
    );
  }

  // Strip internal sort keys
  res.json(
    results.map(({ _scheduledAt: _s, _distance: _d, ...rest }) => rest),
  );
});

// GET /activities/:id
router.get("/activities/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [activity] = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.id, id));

  if (!activity) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  const [host] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, activity.hostUserId));

  const participants = await db
    .select()
    .from(activityParticipantsTable)
    .where(eq(activityParticipantsTable.activityId, id));

  const acceptedCount = participants.filter((p) => p.status === "accepted").length;
  const userParticipant = participants.find(
    (p) => p.userId === req.auth.userId,
  );

  res.json(
    formatActivity(
      activity,
      formatUserProfile(host!),
      acceptedCount,
      userParticipant?.status ?? null,
      null,
    ),
  );
});

// POST /activities
router.post("/activities", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const parsed = CreateActivitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { scheduledAt, ...rest } = parsed.data;

  const [activity] = await db
    .insert(activitiesTable)
    .values({
      ...rest,
      hostUserId: currentUserId,
      scheduledAt: new Date(scheduledAt),
    })
    .returning();

  const [host] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, currentUserId));

  res.status(201).json(
    formatActivity(activity, formatUserProfile(host!), 0, null, null),
  );
});

// POST /activities/:id/join
router.post("/activities/:id/join", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;
  const activityId = parseInt(req.params.id);

  if (isNaN(activityId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [activity] = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.id, activityId));

  if (!activity) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  if (activity.hostUserId === currentUserId) {
    res.status(400).json({ error: "You are the host" });
    return;
  }

  if (activity.status !== "open") {
    res.status(400).json({ error: "Activity is not open" });
    return;
  }

  // Check already joined
  const [existing] = await db
    .select()
    .from(activityParticipantsTable)
    .where(
      and(
        eq(activityParticipantsTable.activityId, activityId),
        eq(activityParticipantsTable.userId, currentUserId),
      ),
    );

  if (existing) {
    res.json({ status: existing.status });
    return;
  }

  const [participant] = await db
    .insert(activityParticipantsTable)
    .values({
      activityId,
      userId: currentUserId,
      status: "pending",
    })
    .returning();

  res.status(201).json({ status: participant.status });
});

// PATCH /activities/:id/participants/:participantId
router.patch(
  "/activities/:id/participants/:participantId",
  async (req, res): Promise<void> => {
    const currentUserId = req.auth.userId;
    const activityId = parseInt(req.params.id);
    const participantId = parseInt(req.params.participantId);

    if (isNaN(activityId) || isNaN(participantId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = z
      .object({ status: z.enum(["accepted", "rejected"]) })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Must be host
    const [activity] = await db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.id, activityId));

    if (!activity || activity.hostUserId !== currentUserId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [updated] = await db
      .update(activityParticipantsTable)
      .set({ status: parsed.data.status })
      .where(
        and(
          eq(activityParticipantsTable.id, participantId),
          eq(activityParticipantsTable.activityId, activityId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Participant not found" });
      return;
    }

    // Auto-update activity status to full if max reached
    if (parsed.data.status === "accepted") {
      const accepted = await db
        .select()
        .from(activityParticipantsTable)
        .where(
          and(
            eq(activityParticipantsTable.activityId, activityId),
            eq(activityParticipantsTable.status, "accepted"),
          ),
        );

      if (accepted.length >= activity.maxParticipants) {
        await db
          .update(activitiesTable)
          .set({ status: "full" })
          .where(eq(activitiesTable.id, activityId));
      }
    }

    res.json({ status: updated.status });
  },
);

// DELETE /activities/:id  (host cancel)
router.delete("/activities/:id", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;
  const activityId = parseInt(req.params.id);

  if (isNaN(activityId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [activity] = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.id, activityId));

  if (!activity || activity.hostUserId !== currentUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db
    .update(activitiesTable)
    .set({ status: "cancelled" })
    .where(eq(activitiesTable.id, activityId));

  res.json({ ok: true });
});

export default router;
