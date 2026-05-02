import { eq, sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  audioFilesTable,
  analysisTable,
  timelineSegmentsTable,
  storyboardScenesTable,
  promptsTable,
  exportsTable,
  activityTable,
  settingsTable,
} from "@workspace/db";
import { buildMockAnalysis, buildPromptText } from "./mockAnalysis";
import { generateScene } from "./sceneGenerator";
import { logger } from "./logger";

export async function seedIfEmpty() {
  try {
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
    if (!existing) {
      await db.insert(settingsTable).values({ id: 1 }).onConflictDoNothing();
    }

    const [{ c } = { c: 0 }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(projectsTable);
    if (c > 0) return;

    logger.info("Seeding demo project");

    const [project] = await db
      .insert(projectsTable)
      .values({
        title: "Black Velvet Static",
        artist: "RONIN/X",
        genre: "Industrial Pop",
        mood: "Anguished, defiant",
        visualDirection:
          "Crimson neon, wet asphalt, slow burn into euphoric chorus detonation",
        status: "exported",
        coverColor: "#FF1B6B",
        durationSec: 198,
      })
      .returning();
    if (!project) return;

    await db.insert(audioFilesTable).values({
      projectId: project.id,
      fileName: "black_velvet_static_master_v3.wav",
      mimeType: "audio/wav",
      sizeBytes: 41_287_104,
      durationSec: 198,
    });

    const analysis = buildMockAnalysis(project.id, 198, 124);
    await db.insert(analysisTable).values({
      projectId: project.id,
      durationSec: 198,
      bpm: analysis.bpm,
      keySignature: analysis.keySignature,
      energy: analysis.energy,
      loudnessDb: analysis.loudnessDb,
      emotionalMap: analysis.emotionalMap,
    });
    const segs = await db
      .insert(timelineSegmentsTable)
      .values(analysis.segments)
      .returning();

    await db
      .update(projectsTable)
      .set({ bpm: analysis.bpm, keySignature: analysis.keySignature })
      .where(eq(projectsTable.id, project.id));

    const scenes = await db
      .insert(storyboardScenesTable)
      .values(
        segs.map((s) =>
          generateScene({
            projectId: project.id,
            segment: s,
            totalSegments: segs.length,
            songTitle: project.title,
            artistName: project.artist,
            visualStyle: "cyberpunk_uprising",
            brandDirection: "Defiant industrial pop with crimson neon iconography",
            lyrics: null,
            seed: project.id,
          }),
        ),
      )
      .returning();

    await db.insert(promptsTable).values(
      scenes.map((s) => ({
        projectId: project.id,
        sceneId: s.id,
        index: s.index,
        model: "runway",
        text: buildPromptText(s),
        negativePrompt: "low quality, watermark, text, blurry, deformed, cartoon",
        aspectRatio: "16:9",
        durationSec: 6,
      })),
    );

    await db.insert(exportsTable).values({
      projectId: project.id,
      format: "production_plan",
      content: `SHOTGUN NINJAS — PRODUCTION PLAN\nProject: ${project.title}\nArtist: ${project.artist}\nDemo export.`,
    });

    await db.insert(activityTable).values([
      { projectId: project.id, kind: "project_created", message: `Project "${project.title}" created` },
      { projectId: project.id, kind: "audio_uploaded", message: `Uploaded master cut` },
      { projectId: project.id, kind: "analyzed", message: `Analyzed audio — ${analysis.bpm} BPM, ${analysis.keySignature}` },
      { projectId: project.id, kind: "storyboard_generated", message: `Generated ${scenes.length} storyboard scenes` },
      { projectId: project.id, kind: "prompts_generated", message: `Generated ${scenes.length} scene prompts` },
      { projectId: project.id, kind: "exported", message: `Exported as production_plan` },
    ]);

    logger.info({ projectId: project.id }, "Demo project seeded");
  } catch (err) {
    logger.error({ err }, "Seed failed");
  }
}
