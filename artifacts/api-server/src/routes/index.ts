import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import connectionsRouter from "./connections";
import conversationsRouter from "./conversations";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";
import activitiesRouter from "./activities";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireAuth);
router.use(usersRouter);
router.use(connectionsRouter);
router.use(conversationsRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);
router.use(activitiesRouter);

export default router;
