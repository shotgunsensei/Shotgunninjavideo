import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import audioRouter from "./audio";
import timelineRouter from "./timeline";
import storyboardRouter from "./storyboard";
import lyricsRouter from "./lyrics";
import continuityRouter from "./continuity";
import promptsRouter from "./prompts";
import promptEngineRouter from "./promptEngine";
import exportsRouter from "./exports";
import settingsRouter from "./settings";
import statsRouter from "./stats";
import billingRouter from "./billing";
import brandPresetsRouter from "./brandPresets";
import marketingAssetsRouter from "./marketingAssets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(statsRouter);
router.use(projectsRouter);
router.use(audioRouter);
router.use(timelineRouter);
router.use(storyboardRouter);
router.use(lyricsRouter);
router.use(continuityRouter);
router.use(promptsRouter);
router.use(promptEngineRouter);
router.use(exportsRouter);
router.use(settingsRouter);
router.use(billingRouter);
router.use(brandPresetsRouter);
router.use(marketingAssetsRouter);

export default router;
