import { Router, type IRouter } from "express";
import { db, reportsTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateReportSchema = z.object({
  targetType: z.enum(["user", "activity", "message"]),
  targetId: z.number().int().positive(),
  reason: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
});

// POST /reports — submit a report
router.post("/reports", async (req, res): Promise<void> => {
  const currentUserId = req.auth.userId;

  const parsed = CreateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { targetType, targetId, reason, description } = parsed.data;

  const [report] = await db
    .insert(reportsTable)
    .values({
      reporterId: currentUserId,
      targetType,
      targetId,
      reason,
      description: description ?? null,
      status: "pending",
    })
    .returning();

  res.status(201).json({
    id: report.id,
    reporterId: report.reporterId,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    description: report.description ?? null,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
  });
});

export default router;
