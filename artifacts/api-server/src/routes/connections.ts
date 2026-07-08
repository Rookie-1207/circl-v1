import { Router, type IRouter } from "express";
import { eq, and, or } from "drizzle-orm";
import { db, connectionsTable, usersTable, conversationsTable, notificationsTable } from "@workspace/db";
import {
  ListConnectionsQueryParams,
  ListConnectionsResponse,
  CreateConnectionBody,
  CreateConnectionResponse,
  UpdateConnectionParams,
  UpdateConnectionBody,
  UpdateConnectionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const CURRENT_USER_ID = 1;

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    ...u,
    bio: u.bio ?? null,
    goals: u.goals ?? null,
    avatarUrl: u.avatarUrl ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

router.get("/connections", async (req, res): Promise<void> => {
  const params = ListConnectionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { status } = params.data;

  const connections = await db
    .select()
    .from(connectionsTable)
    .where(
      and(
        or(
          eq(connectionsTable.fromUserId, CURRENT_USER_ID),
          eq(connectionsTable.toUserId, CURRENT_USER_ID)
        ),
        status ? eq(connectionsTable.status, status) : undefined
      )
    );

  // Fetch all referenced users
  const userIds = new Set<number>();
  for (const c of connections) {
    userIds.add(c.fromUserId);
    userIds.add(c.toUserId);
  }

  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const result = connections.map((c) => ({
    id: c.id,
    fromUserId: c.fromUserId,
    toUserId: c.toUserId,
    status: c.status,
    fromUser: c.fromUserId ? formatUser(userMap.get(c.fromUserId)!) : undefined,
    toUser: c.toUserId ? formatUser(userMap.get(c.toUserId)!) : undefined,
    createdAt: c.createdAt.toISOString(),
  }));

  res.json(ListConnectionsResponse.parse(result));
});

router.post("/connections", async (req, res): Promise<void> => {
  const parsed = CreateConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { toUserId, action } = parsed.data;
  const status = action === "connect" ? "pending" : "passed";

  const [connection] = await db
    .insert(connectionsTable)
    .values({
      fromUserId: CURRENT_USER_ID,
      toUserId,
      status,
    })
    .returning();

  // Create notification for connect requests
  if (action === "connect") {
    const [fromUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, CURRENT_USER_ID));

    await db.insert(notificationsTable).values({
      userId: toUserId,
      type: "connection_request",
      message: `${fromUser?.name ?? "Someone"} wants to connect with you`,
      actorId: CURRENT_USER_ID,
    });
  }

  const [fromUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, CURRENT_USER_ID));

  const [toUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, toUserId));

  res.status(201).json(
    CreateConnectionResponse.parse({
      id: connection.id,
      fromUserId: connection.fromUserId,
      toUserId: connection.toUserId,
      status: connection.status,
      fromUser: fromUser ? formatUser(fromUser) : undefined,
      toUser: toUser ? formatUser(toUser) : undefined,
      createdAt: connection.createdAt.toISOString(),
    })
  );
});

router.patch("/connections/:id", async (req, res): Promise<void> => {
  const pathParams = UpdateConnectionParams.safeParse(req.params);
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }

  const bodyParsed = UpdateConnectionBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  // Only the recipient (toUserId) can accept/reject a connection
  const [connection] = await db
    .update(connectionsTable)
    .set({ status: bodyParsed.data.status })
    .where(
      and(
        eq(connectionsTable.id, pathParams.data.id),
        eq(connectionsTable.toUserId, CURRENT_USER_ID)
      )
    )
    .returning();

  if (!connection) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  // If accepted, create a conversation and notify both users
  if (bodyParsed.data.status === "accepted") {
    const existingConv = await db
      .select()
      .from(conversationsTable)
      .where(
        or(
          and(
            eq(conversationsTable.user1Id, connection.fromUserId),
            eq(conversationsTable.user2Id, connection.toUserId)
          ),
          and(
            eq(conversationsTable.user1Id, connection.toUserId),
            eq(conversationsTable.user2Id, connection.fromUserId)
          )
        )
      );

    if (existingConv.length === 0) {
      await db.insert(conversationsTable).values({
        user1Id: connection.fromUserId,
        user2Id: connection.toUserId,
      });
    }

    // Notify the requester
    const [acceptingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, CURRENT_USER_ID));

    await db.insert(notificationsTable).values({
      userId: connection.fromUserId,
      type: "connection_accepted",
      message: `${acceptingUser?.name ?? "Someone"} accepted your connection request`,
      actorId: connection.toUserId,
    });
  }

  const [fromUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, connection.fromUserId));

  const [toUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, connection.toUserId));

  res.json(
    UpdateConnectionResponse.parse({
      id: connection.id,
      fromUserId: connection.fromUserId,
      toUserId: connection.toUserId,
      status: connection.status,
      fromUser: fromUser ? formatUser(fromUser) : undefined,
      toUser: toUser ? formatUser(toUser) : undefined,
      createdAt: connection.createdAt.toISOString(),
    })
  );
});

export default router;
