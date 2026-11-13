import { Router, type IRouter } from "express";
import healthRouter from "./health";
import baqiRouter from "./baqi";
import storageRouter from "./storage";
import availabilityAlertsRouter from "./availability-alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(baqiRouter);
router.use(storageRouter);
router.use(availabilityAlertsRouter);

export default router;
