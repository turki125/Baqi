import { Router, type IRouter } from "express";
import healthRouter from "./health";
import baqiRouter from "./baqi";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(baqiRouter);
router.use(storageRouter);

export default router;
