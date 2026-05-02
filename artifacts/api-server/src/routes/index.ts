import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import audioRouter from "./audio";
import storyboardRouter from "./storyboard";
import promptsRouter from "./prompts";
import exportsRouter from "./exports";
import settingsRouter from "./settings";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(statsRouter);
router.use(projectsRouter);
router.use(audioRouter);
router.use(storyboardRouter);
router.use(promptsRouter);
router.use(exportsRouter);
router.use(settingsRouter);

export default router;
