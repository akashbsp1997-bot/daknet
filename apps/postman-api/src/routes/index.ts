import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import officesRouter from "./offices";
import usersRouter from "./users";
import beatsRouter from "./beats";
import articlesRouter from "./articles";
import visitsRouter from "./visits";
import addressesRouter from "./addresses";
import locationRouter from "./location";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(officesRouter);
router.use(usersRouter);
router.use(beatsRouter);
router.use(articlesRouter);
router.use(visitsRouter);
router.use(addressesRouter);
router.use(locationRouter);
router.use(dashboardRouter);
router.use(reportsRouter);

export default router;
