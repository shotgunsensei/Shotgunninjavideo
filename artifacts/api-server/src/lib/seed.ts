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
  lyricLinesTable,
  brandPresetsTable,
  type InsertStoryboardScene,
  type InsertTimelineSegment,
  type InsertBrandPreset,
} from "@workspace/db";
import { buildMockAnalysis, buildPromptText } from "./mockAnalysis";
import { generateScene } from "./sceneGenerator";
import { parseLyrics } from "./lyricsParser";
import { logger } from "./logger";

export async function seedIfEmpty() {
  try {
    const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
    if (!existing) {
      await db.insert(settingsTable).values({ id: 1 }).onConflictDoNothing();
    }

    await seedDefaultBrandPresets();
    await seedBlackVelvet();
    await seedShotgunNinjasRise();
  } catch (err) {
    logger.error({ err }, "Seed failed");
  }
}

async function projectExists(title: string): Promise<boolean> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(projectsTable)
    .where(eq(projectsTable.title, title));
  return (row?.c ?? 0) > 0;
}

async function seedBlackVelvet() {
  if (await projectExists("Black Velvet Static")) return;
  logger.info("Seeding demo project: Black Velvet Static");

  // Wrap the entire seed in a transaction so a partial failure rolls the
  // whole project back; otherwise the title-only idempotency check would
  // permanently skip a half-seeded demo on subsequent boots.
  const projectId = await db.transaction(async (tx) => {
    const [project] = await tx
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
    if (!project) throw new Error("Failed to insert Black Velvet Static project");

    await tx.insert(audioFilesTable).values({
      projectId: project.id,
      fileName: "black_velvet_static_master_v3.wav",
      mimeType: "audio/wav",
      sizeBytes: 41_287_104,
      durationSec: 198,
    });

    const analysis = buildMockAnalysis(project.id, 198, 124);
    await tx.insert(analysisTable).values({
      projectId: project.id,
      durationSec: 198,
      bpm: analysis.bpm,
      keySignature: analysis.keySignature,
      energy: analysis.energy,
      loudnessDb: analysis.loudnessDb,
      emotionalMap: analysis.emotionalMap,
    });
    const segs = await tx
      .insert(timelineSegmentsTable)
      .values(analysis.segments)
      .returning();

    await tx
      .update(projectsTable)
      .set({ bpm: analysis.bpm, keySignature: analysis.keySignature })
      .where(eq(projectsTable.id, project.id));

    const scenes = await tx
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

    await tx.insert(promptsTable).values(
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

    await tx.insert(exportsTable).values({
      projectId: project.id,
      format: "production_plan",
      content: `SHOTGUN NINJAS — PRODUCTION PLAN\nProject: ${project.title}\nArtist: ${project.artist}\nDemo export.`,
    });

    await tx.insert(activityTable).values([
      { projectId: project.id, kind: "project_created", message: `Project "${project.title}" created` },
      { projectId: project.id, kind: "audio_uploaded", message: `Uploaded master cut` },
      { projectId: project.id, kind: "analyzed", message: `Analyzed audio — ${analysis.bpm} BPM, ${analysis.keySignature}` },
      { projectId: project.id, kind: "storyboard_generated", message: `Generated ${scenes.length} storyboard scenes` },
      { projectId: project.id, kind: "prompts_generated", message: `Generated ${scenes.length} scene prompts` },
      { projectId: project.id, kind: "exported", message: `Exported as production_plan` },
    ]);

    return project.id;
  });

  logger.info({ projectId }, "Demo project seeded: Black Velvet Static");
}

// ---------------------------------------------------------------------------
// Shotgun Ninjas Rise — built-in template demo
// ---------------------------------------------------------------------------
//
// Hand-curated 11-plot founder/uprising arc that mirrors the Sondo "Plot 1
// through Plot 11" structure. Timestamps run 00:00 → 03:39 (219 seconds).
// All 11 scenes share the gritty-urban + crimson-neon + rooftop language so
// the project doubles as a reusable template for new Shotgun Ninjas videos.

const SN_DURATION_SEC = 219;
const SN_BPM = 96;
const SN_KEY = "A min";

interface PlotSpec {
  index: number;
  startSec: number;
  endSec: number;
  section: string;
  emotion: string;
  intensity: number;
  motion: string;
  title: string;
  description: string;
  shotType: string;
  cameraMovement: string;
  location: string;
  lighting: string;
  colorPalette: string;
  wardrobe: string;
  notes: string;
  environment: string;
  characterAction: string;
  emotionalPurpose: string;
  aiPrompt: string;
}

const SN_PLOTS: PlotSpec[] = [
  {
    index: 0,
    startSec: 0,
    endSec: 20,
    section: "intro",
    emotion: "isolation",
    intensity: 0.2,
    motion: "still",
    title: "Plot 01 — The Empty Workshop",
    description:
      "Plot 01 (00:00–00:20): cold open on the founder alone in a cluttered garage workspace before dawn. Only the hum of a single desk lamp. Breath visible. The music has not arrived yet — the city has not woken up to him.",
    shotType: "tight close-up on hands",
    cameraMovement: "slow dolly-in on the eyes",
    location: "garage workspace stacked with prototypes and whiteboards, single desk lamp glowing at 5am",
    lighting: "single desk lamp practical, deep ambient blackness, raw chiaroscuro",
    colorPalette: "#1B1B1F, #C44536, #E8E8E8, #2A2A2A",
    wardrobe: "oversized black hoodie, distressed denim, fitted cap pulled low",
    notes: "Hold on the pencil scratch. Let the verse breathe in the silence.",
    environment: "garage workspace stacked with prototypes and whiteboards, single desk lamp glowing at 5am",
    characterAction: "founder hunches over butcher paper, sketching alone, breath fogging in the cold",
    emotionalPurpose: "establish the founder as completely alone before the movement begins",
    aiPrompt:
      "Tight close-up on the founder's hands sketching at a desk in a cluttered garage workshop before dawn, single desk lamp practical lighting, deep ambient shadow, breath fogging the air, oversized black hoodie, crimson red mug bleeding color into the frame, 35mm film grain, anamorphic, gritty urban realism, ARRI Alexa look. Negative: bright daylight, polished, glossy, fantasy.",
  },
  {
    index: 1,
    startSec: 20,
    endSec: 40,
    section: "verse",
    emotion: "anchoring resolve",
    intensity: 0.35,
    motion: "low",
    title: "Plot 02 — Sketch on the Wall",
    description:
      "Plot 02 (00:20–00:40): founder pins a hand-drawn red ninja insignia to the drywall and steps back. Index cards fan out around it like a battle plan. The vision is becoming a thing the world will have to answer to.",
    shotType: "tracking shot",
    cameraMovement: "slow dolly-in revealing the wall",
    location: "rough drywall plastered with red index cards and a hand-drawn red ninja insignia",
    lighting: "bare bulb overhead, hard shadows, single hot kicker on the insignia",
    colorPalette: "#FFFFFF, #0A0A0A, #C40000, #3A3A3A",
    wardrobe: "oversized black hoodie, distressed denim, single red bandana around the wrist",
    notes: "Cut on the thumbtack press. Snap zoom into the insignia on the snare hit.",
    environment: "founder's basement war-room wall covered in pinned schematics and red index cards",
    characterAction: "founder pins a bold red ninja insignia card to the wall, jaw set, steps back to take it in",
    emotionalPurpose: "show the moment the private dream becomes a public symbol",
    aiPrompt:
      "Slow tracking dolly revealing a basement wall covered in red index cards and a hand-drawn red ninja insignia, bare bulb overhead lighting, hard shadows, single hot kicker on the insignia, founder in oversized black hoodie pinning the final card with intent, documentary realism, 35mm film grain, ARRI Alexa look, gritty urban grind aesthetic. Negative: fantasy, polished, neon, overlit.",
  },
  {
    index: 2,
    startSec: 40,
    endSec: 60,
    section: "verse",
    emotion: "brotherhood",
    intensity: 0.5,
    motion: "medium",
    title: "Plot 03 — First Recruits",
    description:
      "Plot 03 (00:40–01:00): three figures emerge from the dark of an alley below a crimson neon sign. Knuckles meet the founder's in silence — the first members of the crew, no words required.",
    shotType: "medium handheld",
    cameraMovement: "shoulder-mounted follow",
    location: "narrow alley beneath a crimson neon sign, breath visible, sodium streetlamps spilling onto wet asphalt",
    lighting: "crimson neon rim from the sign overhead, amber sodium fill from the street",
    colorPalette: "#C40000, #1B1B1F, #F4A261, #2A2A2A",
    wardrobe: "matching dark crew jackets, small red ninja patch on the shoulder",
    notes: "Stagger the three entrances on the snares. Land the knuckle-bump on the downbeat.",
    environment: "narrow industrial alley beneath a crimson neon sign at 4am",
    characterAction: "three crew members step out of the shadows one by one and knuckle-bump the founder in silence",
    emotionalPurpose: "earn the brotherhood — make the audience feel the silence of the agreement",
    aiPrompt:
      "Medium handheld tracking shot of the founder in a narrow alley at 4am, three crew members stepping out of the shadows one by one to knuckle-bump in silence, beneath a buzzing crimson neon sign, amber sodium streetlamp fill, wet asphalt, breath visible, matching dark crew jackets with a small red ninja patch on the shoulder, documentary realism, 35mm film grain, gritty urban grind aesthetic, Hype Williams meets Larry Clark. Negative: fantasy, polished, glossy, overlit, stylized neon spectacle.",
  },
  {
    index: 3,
    startSec: 60,
    endSec: 80,
    section: "pre_chorus",
    emotion: "shared resolve",
    intensity: 0.7,
    motion: "high",
    title: "Plot 04 — Rooftop Vow",
    description:
      "Plot 04 (01:00–01:20): the crew climbs to a gravel rooftop overlooking an industrial skyline of smokestacks and substations. Six hands stack center-frame; the founder lays the last hand on top. The pre-chorus lifts the camera with them.",
    shotType: "low-angle hero",
    cameraMovement: "crane up revealing the city",
    location: "gravel rooftop overlooking an industrial skyline of smokestacks and faintly glowing substations",
    lighting: "amber sodium glow from below, cold steel-blue sky above",
    colorPalette: "#F4A261, #1B1B1F, #C44536, #2A2A2A",
    wardrobe: "layered dark workwear, founder wears a red bandana tied at the bicep",
    notes: "Build to the pre-chorus lift — push in on the hand stack as the BPM doubles.",
    environment: "gravel rooftop with weathered HVAC units, industrial skyline behind",
    characterAction: "six hands stack center-frame, founder lays the last hand on top, then the camera cranes up to reveal the skyline",
    emotionalPurpose: "lift the audience with the crew — the vow has weight because the city sees it",
    aiPrompt:
      "Low-angle hero shot of six hands stacked center-frame on a gravel rooftop, founder laying the last hand on top, then crane reveal pulling up to show the industrial skyline of smokestacks and faintly glowing substations behind them, amber sodium glow from below, cold steel-blue sky above, layered dark workwear, red bandana on the founder's bicep, documentary realism, 35mm film grain, ARRI Alexa, gritty urban anthem. Negative: fantasy, polished neon, sci-fi, overlit.",
  },
  {
    index: 4,
    startSec: 80,
    endSec: 100,
    section: "chorus",
    emotion: "defiance",
    intensity: 0.95,
    motion: "explosive",
    title: "Plot 05 — Crimson Anthem",
    description:
      "Plot 05 (01:20–01:40): first chorus detonates. Founder front and center on the rooftop with the crew arrayed behind, crimson neon signage from the city below painting their faces. Performance shot — this is the thesis statement of the whole film.",
    shotType: "low-angle hero",
    cameraMovement: "crane spin around the subject",
    location: "rooftop performance position with crimson neon signage glowing from the city block below",
    lighting: "crimson neon uplight from the city, hard amber backlight, atmospheric haze",
    colorPalette: "#C40000, #F4A261, #1B1B1F, #FFFFFF",
    wardrobe: "founder in a black hoodie with a single red painted ninja insignia on the chest, crew in coordinated black-and-red",
    notes: "Lock the chorus framing here — every later chorus references this composition.",
    environment: "rooftop overlooking a glowing crimson-lit industrial block, atmospheric haze",
    characterAction: "founder delivers the chorus straight to camera while the crew bounces in unison behind",
    emotionalPurpose: "land the thesis of the song — defiance announced to the city",
    aiPrompt:
      "Low-angle hero crane spin around the founder delivering the chorus on a rooftop, crew arrayed behind in coordinated black-and-red, crimson neon uplight from the city block below painting their faces, hard amber backlight, atmospheric haze, founder wearing a black hoodie with a single red painted ninja insignia on the chest, anamorphic widescreen, 35mm film grain, gritty urban anthem aesthetic, Hype Williams meets ARRI Alexa. Negative: pastel, fantasy, daylight, polished glossy CGI.",
  },
  {
    index: 5,
    startSec: 100,
    endSec: 120,
    section: "verse",
    emotion: "self-doubt",
    intensity: 0.45,
    motion: "low",
    title: "Plot 06 — Mirror Hours",
    description:
      "Plot 06 (01:40–02:00): the song pulls back. Founder alone in a cracked bathroom mirror at 2am, water dripping. The doubt scene — the moment every founder knows. Quiet menace, not collapse.",
    shotType: "tight close-up",
    cameraMovement: "static lockdown",
    location: "cracked bathroom mirror lit by a single buzzing fluorescent, water dripping into a stained sink",
    lighting: "single buzzing fluorescent overhead, hard chiaroscuro, deep blacks",
    colorPalette: "#FFFFFF, #0A0A0A, #C44536, #3A3A3A",
    wardrobe: "white tank top, red bandana around the neck, knuckles taped",
    notes: "Hold the static lockdown for the entire verse. Let the audience sit in the doubt.",
    environment: "cramped bathroom with a cracked mirror and a single buzzing fluorescent",
    characterAction: "founder grips the sink and stares down his own reflection, jaw working, never blinking",
    emotionalPurpose: "earn the rise by sitting in the doubt — quiet menace, not collapse",
    aiPrompt:
      "Tight static lockdown close-up on the founder gripping a stained sink and staring down his cracked reflection in a buzzing-fluorescent bathroom at 2am, jaw working, knuckles taped, white tank top, red bandana around the neck, hard chiaroscuro, deep blacks, water dripping, documentary realism, 35mm film grain, gritty urban grind aesthetic, Larry Clark influence. Negative: cheerful, fantasy, neon spectacle, daylight.",
  },
  {
    index: 6,
    startSec: 120,
    endSec: 140,
    section: "bridge",
    emotion: "reignition",
    intensity: 0.65,
    motion: "high",
    title: "Plot 07 — Forge at 4AM",
    description:
      "Plot 07 (02:00–02:20): bridge. Founder back in the workshop, hammering steel under a single hot kicker. Sparks fly into the dark in time with the kick drum. The doubt has converted into work.",
    shotType: "extreme close-up on metal",
    cameraMovement: "rapid zoom on impact",
    location: "decommissioned workshop corner with a steel work-bench, fog lit by a single hot kicker through the rafters",
    lighting: "single hard kicker through fog, sparks as the only fill",
    colorPalette: "#0E0E10, #FF3B00, #8C8C8C, #1A1A1A",
    wardrobe: "stained workshop coveralls over a red shirt, leather gloves, welding mask flipped up",
    notes: "Sync every spark hit to the kick drum. Cut between hammer impact and the founder's eyes.",
    environment: "decommissioned workshop corner at 4am, steel work-bench, fog, sparks",
    characterAction: "founder hammers a steel insignia into shape, sparks raining into the dark on every kick drum hit",
    emotionalPurpose: "convert the doubt into kinetic work — make the audience feel the bridge as labor",
    aiPrompt:
      "Extreme close-up of the founder hammering a steel insignia under a single hot kicker through fog, sparks raining into the dark in time with the kick drum, decommissioned workshop at 4am, stained workshop coveralls over a red shirt, leather gloves, welding mask flipped up, dark industrial cinematography, Trent Reznor music video aesthetic, anamorphic widescreen, real fog, gritty texture. Negative: bright daylight, cheerful, fantasy, pastel, low contrast.",
  },
  {
    index: 7,
    startSec: 140,
    endSec: 160,
    section: "drop",
    emotion: "uprising",
    intensity: 1.0,
    motion: "explosive",
    title: "Plot 08 — Banner Drop",
    description:
      "Plot 08 (02:20–02:40): the drop. A massive crimson banner with the red ninja insignia unfurls across the side of an industrial building, filling the frame. Crew silhouetted against it, fists raised. This is the visual money shot of the whole video.",
    shotType: "wide architectural shot",
    cameraMovement: "crane reveal pulling back from the banner",
    location: "side of a derelict industrial building, ten-story crimson banner unfurling across the brick face",
    lighting: "amber sodium uplight on the banner, cold blue ambient sky",
    colorPalette: "#C40000, #F4A261, #1B1B1F, #FFFFFF",
    wardrobe: "founder centered in a long black coat with the red insignia stitched at the back, crew flanking in coordinated black-and-red",
    notes: "Hit this shot exactly on the bass drop. Hold the wide for at least 8 seconds before cutting.",
    environment: "side of a ten-story derelict industrial building at dusk, with a massive crimson red ninja banner unfurling down its face",
    characterAction: "the crew unfurls a ten-story crimson red ninja banner down the side of the building as the founder stands centered below, fist raised",
    emotionalPurpose: "deliver the visual climax — the symbol now owns the skyline",
    aiPrompt:
      "Wide architectural crane reveal of a ten-story crimson red ninja banner unfurling down the side of a derelict industrial building at dusk, founder centered below in a long black coat with the red insignia stitched on the back, crew flanking in coordinated black-and-red with fists raised, amber sodium uplight on the banner, cold blue ambient sky, anamorphic widescreen, ARRI Alexa, gritty urban anthem aesthetic, Hype Williams scale. Negative: cartoonish, fantasy, low budget CGI, pastel, daylight clean.",
  },
  {
    index: 8,
    startSec: 160,
    endSec: 180,
    section: "chorus",
    emotion: "momentum",
    intensity: 0.9,
    motion: "explosive",
    title: "Plot 09 — Skyline March",
    description:
      "Plot 09 (02:40–03:00): second chorus. The crew marches in formation across a series of connected rooftops, founder at the point. The industrial skyline is now their territory. Drone tracking shot follows them across the cityscape.",
    shotType: "drone tracking shot",
    cameraMovement: "drone descent and parallel track",
    location: "connected rooftops above an industrial skyline at golden hour, smokestacks venting in the background",
    lighting: "magic-hour rim light, atmospheric haze, crimson neon glow rising from the streets below",
    colorPalette: "#F4A261, #C40000, #1B1B1F, #2A2A2A",
    wardrobe: "founder in a long black coat with the red insignia, crew in coordinated black-and-red workwear",
    notes: "Drone parallels the march. Match cut into the founder's face on the chorus hook.",
    environment: "interconnected rooftop skyline at golden hour with smokestacks venting in the background",
    characterAction: "the crew marches in v-formation across connected rooftops, founder at the point, the industrial skyline behind them",
    emotionalPurpose: "let the audience feel the momentum — the movement is no longer hiding",
    aiPrompt:
      "Drone tracking shot paralleling the crew marching in v-formation across connected rooftops at golden hour, founder at the point in a long black coat with red insignia, industrial skyline of smokestacks venting in the background, magic-hour rim light, atmospheric haze, crimson neon glow rising from the streets below, ARRI Alexa, anamorphic widescreen, gritty urban anthem aesthetic, Cole Bennett scale. Negative: empty, isolated, rural, pastel, low contrast.",
  },
  {
    index: 9,
    startSec: 180,
    endSec: 200,
    section: "chorus",
    emotion: "ownership",
    intensity: 0.85,
    motion: "high",
    title: "Plot 10 — The Stand",
    description:
      "Plot 10 (03:00–03:20): the founder front of camera, fully owning it. Match-cut series across the four aspect ratios — same composition, four crops. This is the shot the social cuts will be built around.",
    shotType: "tight performance close-up",
    cameraMovement: "static composed beat with rapid match cuts across crops",
    location: "rooftop performance position, crimson banner reflected in the founder's eyes",
    lighting: "hard crimson key from frame-left, cold blue rim from frame-right",
    colorPalette: "#C40000, #1B1B1F, #FFFFFF, #2A2A2A",
    wardrobe: "founder in a black hoodie with the red painted insignia on the chest, single red bandana at the wrist",
    notes: "Lock this composition for the social pack — capture clean 16:9, 9:16, 1:1, 4:5 plates.",
    environment: "rooftop performance position with the crimson banner reflected in the eyes",
    characterAction: "founder delivers the final chorus straight to camera, fully composed, fully owning it",
    emotionalPurpose: "give the audience the hero shot they will screenshot and share",
    aiPrompt:
      "Tight performance close-up of the founder delivering the final chorus straight to camera on a rooftop, crimson banner reflected in his eyes, hard crimson key from frame-left, cold blue rim from frame-right, black hoodie with the red painted ninja insignia on the chest, single red bandana at the wrist, anamorphic widescreen, ARRI Alexa, gritty urban anthem aesthetic, designed for clean crops to 16:9, 9:16, 1:1, 4:5. Negative: pastel, fantasy, daylight clean, polished CGI.",
  },
  {
    index: 10,
    startSec: 200,
    endSec: 219,
    section: "outro",
    emotion: "ascension",
    intensity: 0.55,
    motion: "medium",
    title: "Plot 11 — Rise",
    description:
      "Plot 11 (03:20–03:39): outro. Founder alone again on the rooftop, sunrise breaking behind him over the industrial skyline, fist raised against the morning sky. The full crew silhouetted along the rooftop edge in the wide reveal. Title card hits: SHOTGUN NINJAS RISE.",
    shotType: "low-angle hero into wide reveal",
    cameraMovement: "slow push-in on the founder, then crane up to wide reveal",
    location: "rooftop edge with sunrise breaking behind the industrial skyline",
    lighting: "high-key sunrise rim with cinematic haze, soft golden bounce",
    colorPalette: "#FFB770, #C44536, #1B1B1F, #FFFFFF",
    wardrobe: "founder in a long black coat with the red insignia stitched at the back, crew silhouetted in matching coats",
    notes: "Hold the final wide for the title card. Let the last drum hit decay over the silhouette.",
    environment: "rooftop edge facing the rising sun over the industrial skyline",
    characterAction: "founder raises a fist against the sunrise, then the camera cranes up to reveal the full crew silhouetted along the entire rooftop edge",
    emotionalPurpose: "land the rise — quiet, earned, owned",
    aiPrompt:
      "Low-angle hero of the founder raising a fist against the sunrise over an industrial skyline, then crane up to a wide reveal of the full crew silhouetted along the rooftop edge in matching long black coats with red insignia stitched at the back, high-key sunrise rim, cinematic haze, soft golden bounce, anamorphic widescreen, ARRI Alexa, gritty urban anthem aesthetic, Patagonia film tonality, ends on a held silhouette for the title card. Negative: pastel cartoon, fantasy CGI, neon spectacle, low quality.",
  },
];

const SN_LYRICS = `[ti:Shotgun Ninjas Rise]
[ar:Shotgun Ninjas]
[al:Founder Energy]
[length:03:39]

[00:02.00]Concrete on my back, breath in the smoke
[00:11.00]Built this from a wire and a sharpened oak
[00:22.00]Pinned to the wall is the line in the chalk
[00:31.00]Red on the door, where the silent ones walk
[00:42.00]Found me a brother with a hammer in his palm
[00:51.00]Sister with a pen and a scar for a calm
[01:02.00]Up on the roof where the wind cuts the bone
[01:11.00]Six of us swearing we don't grind alone
[01:22.00]Crimson on the skyline, that's a Shotgun Ninjas sign
[01:31.00]Underdog rising on a founder's design
[01:42.00]Mirror talkin' loud, sayin' bow to the rod
[01:51.00]I told the mirror back, I don't pray to no god
[02:02.00]Lit a single bulb, put my hand to the steel
[02:11.00]Sparks in the dark — that's the only thing real
[02:22.00]Banner falling red across the city's old face
[02:31.00]Every shut-in window seen a familiar place
[02:42.00]Crew on the rooftops marching in line
[02:51.00]Founder energy, that's a Shotgun Ninjas sign
[03:02.00]Camera lift up, I'm the eye of the storm
[03:11.00]Underdog rising, redefine the new norm
[03:22.00]Last frame, fist in the morning sky
[03:31.00]Shotgun Ninjas RISE — watch the kingdom go by`;

async function seedShotgunNinjasRise() {
  if (await projectExists("Shotgun Ninjas Rise")) return;
  logger.info("Seeding demo project: Shotgun Ninjas Rise");

  // Whole-project transaction — see seedBlackVelvet for rationale.
  const projectId = await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projectsTable)
      .values({
        title: "Shotgun Ninjas Rise",
        artist: "Shotgun Ninjas",
        genre: "Trap-Rock Anthem",
        mood: "Underdog grit, rising defiance",
        visualStyle: "gritty_urban",
        brandDirection:
          "Red ninja founders rising over an industrial skyline. Crimson neon signage, rooftop manifesto energy, underdog builder movement, emotional arc from struggle to rise.",
        visualDirection:
          "Gritty urban uprising. Crimson neon, industrial skyline, rooftop scenes, founder grind to crew anthem. Arc: empty workshop → first recruits → rooftop vow → defiant chorus → mirror doubt → forge → banner drop → skyline march → final rise at sunrise.",
        lyrics: SN_LYRICS,
        status: "exported",
        coverColor: "#C40000",
        durationSec: SN_DURATION_SEC,
      })
      .returning();
    if (!project) throw new Error("Failed to insert Shotgun Ninjas Rise project");

    await tx.insert(audioFilesTable).values({
      projectId: project.id,
      fileName: "shotgun_ninjas_rise_master.wav",
      mimeType: "audio/wav",
      sizeBytes: 45_678_912,
      durationSec: SN_DURATION_SEC,
    });

    // Use buildMockAnalysis only for the smooth emotionalMap curve + baseline
    // energy/loudness numbers; segments + bpm/key are taken from our hand-curated
    // plot spec so the founder arc stays exact.
    const baseline = buildMockAnalysis(project.id, SN_DURATION_SEC, SN_BPM);

    await tx.insert(analysisTable).values({
      projectId: project.id,
      durationSec: SN_DURATION_SEC,
      bpm: SN_BPM,
      keySignature: SN_KEY,
      energy: 0.78,
      loudnessDb: -8.2,
      emotionalMap: baseline.emotionalMap,
    });

    const segmentValues: InsertTimelineSegment[] = SN_PLOTS.map((p) => ({
      projectId: project.id,
      index: p.index,
      startSec: p.startSec,
      endSec: p.endSec,
      section: p.section,
      intensity: p.intensity,
      emotion: p.emotion,
      bpm: SN_BPM,
    }));
    const segs = await tx.insert(timelineSegmentsTable).values(segmentValues).returning();

    await tx
      .update(projectsTable)
      .set({ bpm: SN_BPM, keySignature: SN_KEY })
      .where(eq(projectsTable.id, project.id));

    const sceneValues: Omit<InsertStoryboardScene, "id">[] = SN_PLOTS.map((p, i) => {
      const seg = segs[i];
      if (!seg) throw new Error(`Missing segment for plot ${p.index}`);
      return {
        projectId: project.id,
        segmentId: seg.id,
        index: p.index,
        startSec: p.startSec,
        endSec: p.endSec,
        title: p.title,
        description: p.description,
        shotType: p.shotType,
        cameraMovement: p.cameraMovement,
        location: p.location,
        lighting: p.lighting,
        colorPalette: p.colorPalette,
        wardrobe: p.wardrobe,
        notes: p.notes,
        environment: p.environment,
        characterAction: p.characterAction,
        emotionalPurpose: p.emotionalPurpose,
        motionIntensity: p.motion,
        aiPrompt: p.aiPrompt,
        // Lock every curated plot scene so "Improve / regenerate storyboard"
        // never clobbers the hand-authored Plot 01 → Plot 11 template. Users
        // who want to remix the demo can unlock individual scenes and
        // regenerate them, or click "Force regenerate all".
        locked: true,
      };
    });
    const scenes = await tx.insert(storyboardScenesTable).values(sceneValues).returning();

    // Persist parsed lyrics with timestamps and snap each line into its scene.
    const parsed = parseLyrics(SN_LYRICS);
    if (parsed.length > 0) {
      await tx.insert(lyricLinesTable).values(
        parsed.map((l) => {
          const ts = l.timestampSec;
          const matchedScene =
            ts != null
              ? scenes.find((s) => ts >= s.startSec && ts < s.endSec)
              : undefined;
          return {
            projectId: project.id,
            index: l.index,
            text: l.text,
            timestampSec: ts,
            sceneId: matchedScene?.id ?? null,
          };
        }),
      );
    }

    await tx.insert(promptsTable).values(
      scenes.map((s) => ({
        projectId: project.id,
        sceneId: s.id,
        index: s.index,
        model: "runway",
        text: buildPromptText(s),
        negativePrompt:
          "low quality, watermark, text, blurry, deformed, daylight cartoon, fantasy, pastel, polished CGI",
        aspectRatio: "16:9",
        durationSec: 6,
      })),
    );

    await tx.insert(exportsTable).values({
      projectId: project.id,
      format: "production_plan",
      content: `SHOTGUN NINJAS — PRODUCTION PLAN\nProject: ${project.title}\nArtist: ${project.artist}\n11-plot founder uprising template, 00:00 → 03:39.\nUse this as the starting structure for new Shotgun Ninjas music videos.`,
    });

    // Activity kinds are constrained by the OpenAPI ActivityItem enum
    // (project_created | audio_uploaded | analyzed | storyboard_generated |
    // prompts_generated | exported). Lyric import is folded into the
    // storyboard_generated message rather than a custom kind.
    await tx.insert(activityTable).values([
      { projectId: project.id, kind: "project_created", message: `Project "${project.title}" created from built-in template` },
      { projectId: project.id, kind: "audio_uploaded", message: `Loaded reference master cut` },
      { projectId: project.id, kind: "analyzed", message: `Analyzed audio — ${SN_BPM} BPM, ${SN_KEY}` },
      { projectId: project.id, kind: "storyboard_generated", message: `Generated ${scenes.length} plot scenes (Plot 01 → Plot 11) with ${parsed.length} timed lyric lines snapped in` },
      { projectId: project.id, kind: "prompts_generated", message: `Generated ${scenes.length} scene prompts` },
      { projectId: project.id, kind: "exported", message: `Exported as production_plan` },
    ]);

    return project.id;
  });

  logger.info({ projectId }, "Demo project seeded: Shotgun Ninjas Rise");
}

// ---------------------------------------------------------------------------
// Default brand presets — re-seedable, idempotent by name+isDefault=true
// ---------------------------------------------------------------------------

const DEFAULT_BRAND_PRESETS: Omit<InsertBrandPreset, "id" | "createdAt" | "updatedAt" | "isDefault">[] = [
  {
    name: "Shotgun Ninjas Productions",
    characterDescription:
      "Lone founder figure in oversized black hoodie, distressed denim, fitted cap pulled low, single red bandana at wrist or neck. Crew variants in coordinated black-and-red workwear with a small red ninja patch on the shoulder.",
    colorPalette: "#C40000, #1B1B1F, #F4A261, #FFFFFF, #2A2A2A",
    visualStyle:
      "Gritty urban uprising. Crimson neon signage, wet asphalt, atmospheric haze, rooftop manifesto energy. Hype Williams scale meets Larry Clark documentary realism. 35mm film grain, anamorphic widescreen, ARRI Alexa look.",
    logoDescription:
      "Hand-drawn red ninja insignia — bold crimson silhouette on a stark white or black field. Always rendered with rough-edged authenticity, never cleaned up.",
    voiceTone:
      "Defiant, anchoring, brotherhood-first. Underdog founder energy. Quiet menace over loud bravado.",
    recurringSymbols:
      "red ninja insignia, crimson neon signage, rooftop skyline, single desk lamp, hammer + sparks, stacked-hands vow, banner unfurl, fist raised at sunrise",
    cameraLanguage:
      "Low-angle hero, slow dolly-in on the eyes, crane reveal pulling up to industrial skyline, drone parallel track across rooftops, static lockdown for the doubt beats",
    negativePromptRules:
      "fantasy, daylight clean, polished glossy CGI, pastel, cartoonish, low contrast, sci-fi, overlit",
    watermarkText: "SHOTGUN NINJAS",
  },
  {
    name: "TorqueShed",
    characterDescription:
      "Gloved mechanic-engineer in stained navy work shirt, sleeves rolled, leather apron, safety glasses pushed up on the forehead. Hands always in frame: oil-blackened, capable.",
    colorPalette: "#0E0E10, #FF6A00, #C0C0C0, #1F2937, #F5C518",
    visualStyle:
      "Industrial workshop after dark. Sodium-orange task lighting, cool steel reflections, sparks and torque haze. Mechanical precision crossed with grit. Practical lighting only — no neon spectacle.",
    logoDescription:
      "Stamped-steel wordmark 'TORQUESHED' in heavy slab serif, embossed with a faint torque-arrow over the T.",
    voiceTone:
      "Direct, calloused, mechanically confident. No marketing speak — torque values and tolerances.",
    recurringSymbols:
      "torque wrench, sparking grinder, steel shavings, blueprint pinned to pegboard, oil-stained rag, halogen drop lamp",
    cameraLanguage:
      "Macro on metal, rack-focus from tool to face, locked-off product shot, slow push-in on the part being worked",
    negativePromptRules:
      "clean office, white background, stock-photo polish, fashion lighting, fantasy, cartoon, oversaturated",
    watermarkText: "TORQUESHED // BUILT IN THE SHED",
  },
  {
    name: "TradeFlowKit",
    characterDescription:
      "Working tradesperson in branded hi-vis softshell over a clean tee, tablet in one hand, framing tape in the other. Crew shots show two-to-three trades collaborating on a clean job site.",
    colorPalette: "#FFB000, #1E2A38, #FFFFFF, #4B5563, #22C55E",
    visualStyle:
      "Bright, optimistic job-site documentary. Golden-hour exteriors, clean indoor framing with shallow depth of field. App UI integrated as floating cards over the work, never replacing it.",
    logoDescription:
      "'TRADEFLOWKIT' in geometric sans, with a flowing arrow tying TRADE → FLOW → KIT, hi-vis amber accent.",
    voiceTone:
      "Practical, helpful, mid-job-site direct. Speaks in checklists and time saved, not features.",
    recurringSymbols:
      "hi-vis amber stripe, tablet checklist overlay, framing tape measure, completed punch-list checkmark, two-trades handshake",
    cameraLanguage:
      "Handheld walk-and-talk, clean over-the-shoulder of the tablet, exterior wide of the finished job, time-lapse of the punch list ticking down",
    negativePromptRules:
      "dirty job site exaggeration, comic exaggeration, broken tools, frustrated body language, dark moody grading",
    watermarkText: "TRADEFLOWKIT",
  },
  {
    name: "TechDeck",
    characterDescription:
      "Calm engineer at a triple-monitor workstation, dark hoodie or merino crewneck, mechanical keyboard in the foreground. Hands on keys, not on chin — building, not posing.",
    colorPalette: "#0B1220, #00E5FF, #F59E0B, #E5E7EB, #111827",
    visualStyle:
      "Late-night build energy. Deep navy darkroom, cyan monitor glow, single warm amber kicker from a desk lamp. Hardware close-ups inter-cut with code-on-screen. Cinematic Apple-keynote restraint.",
    logoDescription:
      "'TECHDECK' wordmark in monospace, with a subtle stacked-card glyph behind the T forming a deck of layered planes.",
    voiceTone:
      "Calm engineering authority. Specifications over adjectives. Never hype — always ship-quality.",
    recurringSymbols:
      "mechanical keyboard rows, RGB-off motherboard close-up, terminal cursor blink, oscilloscope trace, cable-managed rack",
    cameraLanguage:
      "Slow macro slider across the keyboard, rack-focus from screen text to engineer's eyes, locked-off product hero, parallax push on the tower",
    negativePromptRules:
      "gamer-rgb spectacle, neon arcade, anime, fantasy, cluttered desk, frustrated engineer, marketing-bro lighting",
    watermarkText: "TECHDECK",
  },
  {
    name: "PulseDesk",
    characterDescription:
      "Approachable healthcare-ops lead in soft scrubs or a clean blazer, mid-conversation with a colleague at a standing desk. Always shoulders-up warmth — eye contact with the patient or teammate, never with the camera.",
    colorPalette: "#10B981, #FFFFFF, #FB7185, #0F172A, #F1F5F9",
    visualStyle:
      "Bright, calm clinical-modern. Soft daylight from large windows, warm coral accent on a single object per frame. Clean white architecture, no cold-blue 'medical' clichés. Trust through restraint.",
    logoDescription:
      "'PULSEDESK' in humanist sans with a subtle ECG pulse line tracing through the U, mint-green stroke.",
    voiceTone:
      "Warm, reassuring, clinically precise without jargon. Speaks like a senior charge nurse who has seen everything.",
    recurringSymbols:
      "single ECG pulse line, mint-green status dot, soft-rounded UI card, fresh tulip on a desk corner, patient hand-on-hand",
    cameraLanguage:
      "Soft handheld over-the-shoulder, slow push-in on the conversation, shallow-depth product hero of the dashboard, gentle pull-back to reveal the team",
    negativePromptRules:
      "cold blue hospital lighting, dramatic ER chaos, fear-based imagery, clinical sterility extreme, dystopian, low-light moody",
    watermarkText: "PULSEDESK",
  },
  {
    name: "FaultlineLab",
    characterDescription:
      "Field geologist or seismic researcher in a slate-grey field jacket over a thermal layer, ruggedized tablet, headlamp pushed onto the brow. Always at-the-data, never staged.",
    colorPalette: "#1F2937, #F43F5E, #F59E0B, #94A3B8, #0F172A",
    visualStyle:
      "Research-station authenticity. Cold ambient daylight from a high window, signal-red and warning-amber as the only saturated colors — used for data points, not decoration. Charts and maps are diegetic, on actual screens.",
    logoDescription:
      "'FAULTLINELAB' in technical sans with a jagged signal-red fault line cracking horizontally through the wordmark.",
    voiceTone:
      "Measured scientific authority. Speaks in confidence intervals and observed magnitudes. Never sensationalizes — the data is dramatic enough.",
    recurringSymbols:
      "seismic waveform, contoured fault map, ruggedized tablet, geologic core sample, signal-red warning dot, amber alert pulse",
    cameraLanguage:
      "Locked-off observational wide, slow zoom on the data screen, rack-focus from sensor to researcher, drone-down on the field site",
    negativePromptRules:
      "disaster-movie melodrama, exploding cgi, glossy news graphics, fantasy, neon, cheerful, oversaturated",
    watermarkText: "FAULTLINELAB",
  },
  {
    name: "Shotgun Ninja Village",
    characterDescription:
      "Multigenerational village crew — elders, builders, and kids — in everyday warm-toned workwear with a single small red ninja patch sewn onto the sleeve or cap. Always a community shot, never a lone hero.",
    colorPalette: "#C44536, #F4A261, #2A9D8F, #E9C46A, #FFFFFF",
    visualStyle:
      "Daylight community documentary. Open courtyards, painted brick walls, market-stall warmth. Crimson stays as the brand accent but the world is sun-warm and inhabited. Anti-corporate, anti-edgy — earned belonging.",
    logoDescription:
      "Hand-painted red ninja insignia inside a circular village seal, with the village name curved around it in a friendly hand-lettered serif.",
    voiceTone:
      "Welcoming village-elder warmth. Speaks in 'we' and 'come sit'. Brotherhood broadened to neighborhood.",
    recurringSymbols:
      "red ninja insignia (small, sewn-on), shared courtyard table, painted brick wall, market lanterns, kids and elders side-by-side, communal cooking pot",
    cameraLanguage:
      "Wide observational courtyards, slow handheld through the market, golden-hour reveals over rooftops, intimate medium shots of conversation",
    negativePromptRules:
      "lone-hero framing, edgy nightclub neon, dystopian, gritty grime, isolation, hype-bro posturing, cold-blue moody",
    watermarkText: "SHOTGUN NINJA VILLAGE",
  },
];

async function seedDefaultBrandPresets() {
  const { and } = await import("drizzle-orm");
  for (const preset of DEFAULT_BRAND_PRESETS) {
    // Match on (name, isDefault=true) so a user-created preset that happens to
    // share a name doesn't block the default from being seeded.
    const [existing] = await db
      .select()
      .from(brandPresetsTable)
      .where(
        and(
          eq(brandPresetsTable.name, preset.name),
          eq(brandPresetsTable.isDefault, true),
        ),
      );
    if (existing) continue;
    await db.insert(brandPresetsTable).values({ ...preset, isDefault: true });
    logger.info({ name: preset.name }, "Seeded default brand preset");
  }
}
