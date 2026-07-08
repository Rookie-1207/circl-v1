import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import connectionsRouter from "./connections";
import conversationsRouter from "./conversations";
import notificationsRouter from "./notifications";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(connectionsRouter);
router.use(conversationsRouter);
router.use(notificationsRouter);
router.use(dashboardRouter);

export default router;
