import type { InsertStoryboardScene } from "@workspace/db";

export type VisualStyleId =
  | "cyberpunk_uprising"
  | "gritty_urban"
  | "anime_cinematic"
  | "dark_industrial"
  | "motivational_founder"
  | "street_mv"
  | "luxury_cinematic"
  | "horror_energy"
  | "scifi_neon"
  | "custom";

export interface VisualStylePreset {
  id: VisualStyleId;
  label: string;
  environments: string[];
  lightingPalettes: { lighting: string; palette: string }[];
  shotTypes: string[];
  cameraMoves: string[];
  characterActions: string[];
  wardrobe: string[];
  emotionalPurposes: string[];
  promptModifiers: string[];
  negativeKeywords: string[];
}

export const VISUAL_STYLES: Record<VisualStyleId, VisualStylePreset> = {
  cyberpunk_uprising: {
    id: "cyberpunk_uprising",
    label: "Cyberpunk Uprising",
    environments: [
      "rain-soaked megacity alley under towering holographic billboards",
      "abandoned cyber-temple lit by flickering CRT shrines",
      "rooftop helipad above a neon-soaked sprawl",
      "underground hacker den crowded with server racks",
      "monorail tunnel pulsing with magenta strip lighting",
      "ramen stall in a steam-filled night market",
    ],
    lightingPalettes: [
      { lighting: "neon magenta key with cyan rim, hard practicals", palette: "#FF1B6B, #00E5FF, #0B0B14, #7B2CBF" },
      { lighting: "ultraviolet wash through atmospheric haze", palette: "#9D4EDD, #240046, #FF006E, #10002B" },
      { lighting: "hologram bounce, electric teal fill", palette: "#00FFD1, #FF2A6D, #05010F, #1A1A2E" },
    ],
    shotTypes: ["extreme close-up", "wide architectural shot", "dutch angle medium", "low-angle hero", "drone descent"],
    cameraMoves: ["slow dolly-in through neon haze", "handheld whip pan", "crane reveal from above", "360° orbit", "rapid push-in on eyes"],
    characterActions: [
      "subject pulls a chrome implant from their forearm and stares it down",
      "subject sprints across rain puddles, jacket trailing sparks",
      "subject tags a wall while drones swarm overhead",
      "subject plants a glowing relic and mouths the lyric",
      "subject turns into camera, eyes catching neon glow",
    ],
    wardrobe: [
      "black tactical leather with crimson seams and chrome jewelry",
      "oversized translucent raincoat over mesh, LED gloves",
      "monochrome streetwear with reflective patches",
      "silver bomber, neon undershirt, smudged eyeliner",
    ],
    emotionalPurposes: [
      "establish defiance against the system",
      "ignite rebellion as the chorus lands",
      "let the protagonist taste freedom for the first time",
      "weaponize loneliness into momentum",
    ],
    promptModifiers: [
      "cinematic cyberpunk aesthetic, anamorphic lens flares, volumetric neon haze",
      "Blade Runner inspired, wet streets, holographic signage",
      "35mm film grain, deep blacks, saturated magenta and cyan",
    ],
    negativeKeywords: ["daylight", "rural", "sunny", "low contrast", "flat lighting"],
  },
  gritty_urban: {
    id: "gritty_urban",
    label: "Gritty Urban Grind",
    environments: [
      "concrete rooftop overlooking sodium-lit projects",
      "graffiti-tagged underpass at 3am",
      "boxing gym lit by single hanging bulb",
      "convenience store parking lot under buzzing fluorescents",
      "row-house stoop in pre-dawn fog",
      "abandoned basketball court behind chain-link",
    ],
    lightingPalettes: [
      { lighting: "amber sodium streetlamps with hard shadows", palette: "#F4A261, #1B1B1F, #E63946, #2A2A2A" },
      { lighting: "single overhead practical, raw chiaroscuro", palette: "#FFFFFF, #0A0A0A, #B5651D, #3A3A3A" },
      { lighting: "muted moonlight, breath visible in cold air", palette: "#A4C3D2, #1C1C1F, #C44536, #2C2C2C" },
    ],
    shotTypes: ["medium handheld", "low-angle hero", "tight close-up", "tracking shot", "over-the-shoulder"],
    cameraMoves: ["raw handheld follow", "slow dolly-in on the eyes", "static lockdown", "shoulder-mounted sprint", "slow push from feet to face"],
    characterActions: [
      "subject wraps fists in tape and stares down the camera",
      "subject paces between parked cars, breath fogging the air",
      "subject leans against a wall, eyes scanning the block",
      "subject counts a stack of bills, jaw clenched",
      "crew gathers around the subject, silent solidarity",
    ],
    wardrobe: [
      "oversized hoodie, distressed denim, fitted cap",
      "leather jacket with patched elbows, gold chain",
      "thermal layers, cargo pants, work boots",
      "tracksuit, cross necklace, beaten Air Force 1s",
    ],
    emotionalPurposes: [
      "show the cost of survival",
      "anchor the lyric in lived reality",
      "build brotherhood before the storm",
      "communicate quiet menace",
    ],
    promptModifiers: [
      "documentary realism, 35mm film grain, natural skin tones",
      "Hype Williams meets Larry Clark, gritty desaturated palette",
      "ARRI Alexa look, anamorphic, motivated practical lighting",
    ],
    negativeKeywords: ["fantasy", "polished", "glossy", "overlit", "stylized neon"],
  },
  anime_cinematic: {
    id: "anime_cinematic",
    label: "Anime Cinematic",
    environments: [
      "Tokyo crosswalk at golden hour, cherry petals drifting",
      "rooftop overlooking a sunset megacity skyline",
      "shrine staircase carved through ancient cedars",
      "convenience store at midnight, fluorescent halos",
      "school hallway pierced by a single lens flare",
      "futuristic train hurtling above a glowing bay",
    ],
    lightingPalettes: [
      { lighting: "magic-hour rim light with anamorphic flares", palette: "#FFB199, #6A89CC, #FFFFFF, #2D2D44" },
      { lighting: "moody twilight, soft cyan rim and warm key", palette: "#9AD0F5, #FFB36B, #1B1F3A, #F4F1E8" },
      { lighting: "high-key sun beams through dust motes", palette: "#FFE699, #FFB199, #C7CEEA, #1F1F2E" },
    ],
    shotTypes: ["wide environmental hero", "POV close-up", "low-angle reveal", "extreme telephoto detail", "dramatic upshot"],
    cameraMoves: ["slow parallax pan", "dramatic crane up", "subject-locked dolly", "speed-ramped whip", "static framed beat"],
    characterActions: [
      "subject turns mid-stride, hair catching the wind",
      "subject reaches toward the lens as light blooms behind them",
      "subject sprints across the frame, coat billowing",
      "subject stands silhouetted against a setting sun",
      "subject locks eyes with the lens and the world freezes",
    ],
    wardrobe: [
      "oversized seifuku-inspired uniform with bold accent color",
      "techwear coat with reflective trim and combat boots",
      "loose layered streetwear, single statement accessory",
      "flowing trench, scarf catching the wind",
    ],
    emotionalPurposes: [
      "convey the moment of resolve",
      "anchor a quiet ache against a vast world",
      "celebrate the leap before the leap",
      "freeze the frame on transformation",
    ],
    promptModifiers: [
      "anime cinematic, Makoto Shinkai inspired, painterly skies, light bloom",
      "cel-shaded influence with photoreal detail, shallow depth of field",
      "Wong Kar-wai color grading, anamorphic flares, dust motes in air",
    ],
    negativeKeywords: ["flat lighting", "drab palette", "documentary harshness", "horror"],
  },
  dark_industrial: {
    id: "dark_industrial",
    label: "Dark Industrial",
    environments: [
      "decommissioned steel mill with shafts of dust-lit light",
      "endless concrete corridor lined with humming transformers",
      "abandoned refinery at dusk, flame stacks in the distance",
      "underground bunker with bare bulbs and chain-link",
      "freight elevator descending into red-lit depths",
      "loading bay with strobing security lights",
    ],
    lightingPalettes: [
      { lighting: "single hard kicker through fog, deep shadows", palette: "#0E0E10, #FF3B00, #8C8C8C, #1A1A1A" },
      { lighting: "sodium work lights, oil-slick highlights", palette: "#F2A03D, #1A1A1A, #3D3D3D, #C1272D" },
      { lighting: "strobe pulses synced to bass hits", palette: "#FFFFFF, #000000, #FF1818, #2B2B2B" },
    ],
    shotTypes: ["wide architectural", "extreme close-up on metal", "low-angle hero", "tracking shot", "tight medium"],
    cameraMoves: ["slow dolly through machinery", "static lockdown with strobe cuts", "crane down from rafters", "handheld shoulder follow", "rapid zoom on impact"],
    characterActions: [
      "subject welds sparks into the dark, mask down",
      "subject stalks down the corridor, fists clenched",
      "subject hammers a steel drum in time with the kick",
      "subject stands motionless as machinery rumbles around them",
      "subject hauls a chain across the frame",
    ],
    wardrobe: [
      "stained coveralls, leather gloves, welding mask",
      "tactical vest over thermal layers",
      "black workwear with metal hardware",
      "oilcloth duster, steel-toe boots, chain belt",
    ],
    emotionalPurposes: [
      "communicate the weight of labor",
      "make the listener feel the machinery underfoot",
      "ground the song's force in physical effort",
      "show isolation inside a brutal system",
    ],
    promptModifiers: [
      "dark industrial cinematography, Trent Reznor music video aesthetic, heavy atmosphere",
      "Tarkovsky meets Nine Inch Nails, oppressive textures, real fog",
      "rust, oil, sweat, sparks, anamorphic widescreen",
    ],
    negativeKeywords: ["bright", "cheerful", "pastel", "fantasy", "clean"],
  },
  motivational_founder: {
    id: "motivational_founder",
    label: "Motivational Founder Story",
    environments: [
      "empty office at sunrise, city skyline waking up beyond the windows",
      "garage workspace stacked with prototypes and whiteboards",
      "long stairwell climbing toward a shaft of morning light",
      "rooftop with the city sprawling at the founder's feet",
      "warehouse mid-build, scaffolding catching golden hour",
      "minimal home studio at 5am, single desk lamp glowing",
    ],
    lightingPalettes: [
      { lighting: "soft golden hour through floor-to-ceiling glass", palette: "#FFB770, #2C3E50, #FFFFFF, #C9A66B" },
      { lighting: "warm desk lamp with cool city ambient", palette: "#FFD27F, #1F2A36, #E8E8E8, #5C6B80" },
      { lighting: "high-key sunrise rim, cinematic haze", palette: "#FFF4E2, #2A2D34, #F0A868, #4A5568" },
    ],
    shotTypes: ["medium portrait", "wide environmental establishing", "tight close-up on hands", "over-the-shoulder", "low-angle hero"],
    cameraMoves: ["slow dolly toward the subject", "crane up revealing the city", "steady push-in on resolve", "handheld walk-and-talk", "static held beat"],
    characterActions: [
      "founder sketches a blueprint while the sun rises behind them",
      "founder paces while taking a call, decisions visibly forming",
      "founder pins a vision wall with index cards",
      "founder addresses an empty room as if it were full",
      "founder walks alone up the stairwell into the light",
    ],
    wardrobe: [
      "minimalist black knitwear with quiet luxury watch",
      "well-worn hoodie, premium denim, sneakers",
      "tailored overcoat over plain tee, no logos",
      "linen shirt rolled to the elbow, leather notebook in hand",
    ],
    emotionalPurposes: [
      "convey solitude as preparation, not weakness",
      "anchor the lyric in a single decisive moment",
      "show the cost of conviction",
      "celebrate the climb before the summit",
    ],
    promptModifiers: [
      "premium documentary aesthetic, Apple keynote film tone, cinematic golden hour",
      "Patagonia film grain, Sony Venice color science, shallow depth of field",
      "quiet, observational, no captions, beautiful negative space",
    ],
    negativeKeywords: ["chaotic", "cluttered", "neon", "horror", "garish"],
  },
  street_mv: {
    id: "street_mv",
    label: "Street-Level Music Video",
    environments: [
      "block party with crowd spilling into the street",
      "subway platform as a train rips past behind the subject",
      "corner store with crew posted on the curb",
      "rooftop overlooking the project skyline at golden hour",
      "underpass with crew arrayed in formation",
      "arcade lit by CRT glow, crew leaning on machines",
    ],
    lightingPalettes: [
      { lighting: "magic hour with sun flares cutting through the crowd", palette: "#FF8C42, #2B2D42, #EF233C, #EDF2F4" },
      { lighting: "mixed practicals: shop signs, taillights, phone screens", palette: "#F94144, #277DA1, #F9C74F, #1B1B1B" },
      { lighting: "harsh midday sun, deep shadows on concrete", palette: "#FFFFFF, #1A1A1A, #E63946, #A8DADC" },
    ],
    shotTypes: ["wide crew shot", "tight performance close-up", "low-angle hero", "tracking shot", "crowd POV"],
    cameraMoves: ["fisheye walk-up", "crane spin around the subject", "handheld crowd weave", "slow dolly through the crew", "rapid whip between crew members"],
    characterActions: [
      "subject performs the hook while the crew bounces in unison",
      "subject ad-libs into the lens, crew reacting around them",
      "crew opens a path as subject strides forward delivering the verse",
      "subject and crew freeze on the beat drop",
      "subject smokes off-camera while delivering a knowing look",
    ],
    wardrobe: [
      "designer streetwear, mixed grails, statement chain",
      "matching crew fits in coordinated colorway",
      "vintage athletic, throwback jersey, retro shades",
      "oversized varsity jacket, baggy denim, fresh sneakers",
    ],
    emotionalPurposes: [
      "celebrate the crew as the message",
      "anchor the lyric in shared territory",
      "show ownership of the block",
      "ride the swagger of the chorus",
    ],
    promptModifiers: [
      "Hype Williams / Cole Bennett music video aesthetic, glossy yet authentic",
      "ARRI Alexa Mini, anamorphic, vivid color grade",
      "fisheye accents, crew choreography, motion-rich edits",
    ],
    negativeKeywords: ["empty", "isolated", "horror", "rural", "dull palette"],
  },
  luxury_cinematic: {
    id: "luxury_cinematic",
    label: "Luxury Cinematic",
    environments: [
      "marble-floored penthouse overlooking a glowing skyline",
      "private yacht deck at golden hour, water glittering",
      "vintage sports car interior, dashboard glowing amber",
      "champagne-lit private dining room",
      "rooftop infinity pool with the city melting into night",
      "obsidian gallery space lit by single sculpture spotlight",
    ],
    lightingPalettes: [
      { lighting: "warm tungsten practicals with cool city ambient", palette: "#D4AF37, #0B0B0B, #F5F5F0, #1F1F1F" },
      { lighting: "honey backlight through sheer curtains", palette: "#E5C07B, #2C1B0E, #FFFFFF, #6E5A3D" },
      { lighting: "obsidian void with single hero key", palette: "#000000, #C9A227, #F5F5F5, #2A2A2A" },
    ],
    shotTypes: ["wide architectural", "tight detail of texture", "slow dolly portrait", "over-the-shoulder", "static composed beat"],
    cameraMoves: ["slow dolly across marble", "crane reveal from chandelier", "subject-locked orbit", "static held wide", "soft push-in on the gaze"],
    characterActions: [
      "subject pours champagne in slow motion as the lyric lands",
      "subject runs fingers along the dashboard, gaze locked on the road",
      "subject removes a watch and sets it down with intention",
      "subject lounges across the frame, untouchable",
      "subject lights a cigarette by candlelight, smoke curling",
    ],
    wardrobe: [
      "tailored black suit, silk shirt unbuttoned, gold accents",
      "floor-length silk gown with statement jewelry",
      "cashmere overcoat, leather gloves, vintage timepiece",
      "monochrome couture with architectural silhouette",
    ],
    emotionalPurposes: [
      "communicate effortless arrival",
      "frame the lyric as a quiet flex",
      "let stillness become the statement",
      "elevate desire into longing",
    ],
    promptModifiers: [
      "luxury campaign cinematography, Tom Ford aesthetic, slow motion, shallow depth",
      "ARRI Alexa 65, anamorphic, Roger Deakins inspired tonality",
      "champagne, marble, gold, leather — tactile premium textures",
    ],
    negativeKeywords: ["budget", "cluttered", "harsh", "neon", "low quality"],
  },
  horror_energy: {
    id: "horror_energy",
    label: "Horror Energy",
    environments: [
      "abandoned hospital corridor with flickering fluorescents",
      "dense midnight forest threaded with mist",
      "decrepit Victorian dining room covered in dust",
      "underground crypt lit by candlelight",
      "rural farmhouse standing alone on a moonlit hill",
      "empty motel pool deck, water unnaturally still",
    ],
    lightingPalettes: [
      { lighting: "single flickering practical, deep ambient blackness", palette: "#0A0A0A, #C40000, #2C2C2C, #DCDCDC" },
      { lighting: "moonlit blue with crimson rim", palette: "#1B2A41, #C40000, #0A0A0A, #B0B7C3" },
      { lighting: "candlelight chiaroscuro with smoke", palette: "#1A1410, #E08A4A, #0A0A0A, #4A2E1A" },
    ],
    shotTypes: ["dutch angle medium", "extreme close-up on detail", "long lens stalker view", "wide establishing", "POV"],
    cameraMoves: ["slow dolly-in toward the unseen", "static held beat", "creeping push past doorways", "handheld stalker follow", "crash zoom on the reveal"],
    characterActions: [
      "subject turns slowly toward something unseen",
      "subject runs a hand along peeling wallpaper",
      "subject mouths the lyric while standing impossibly still",
      "subject locks eyes with the lens and smiles wrong",
      "subject backs away from a doorway, never blinking",
    ],
    wardrobe: [
      "blood-spattered white gown, hair wet",
      "tattered Victorian suit with blackened lapels",
      "monochrome priest collar with crimson sash",
      "modern streetwear soaked in rain",
    ],
    emotionalPurposes: [
      "lock the listener in dread",
      "let the chorus arrive like a held breath releasing",
      "weaponize stillness",
      "make the silence feel watched",
    ],
    promptModifiers: [
      "horror cinematography, Robert Eggers / Ari Aster aesthetic, slow tension",
      "anamorphic widescreen, deep blacks, candle and practical only",
      "natural unease, no cheap jump scares, observational dread",
    ],
    negativeKeywords: ["cheerful", "saturated", "comedic", "bright daylight"],
  },
  scifi_neon: {
    id: "scifi_neon",
    label: "Sci-Fi Neon",
    environments: [
      "spacecraft cockpit aglow with HUD readouts",
      "alien marketplace lit by bioluminescent flora",
      "orbital station observation deck overlooking a nebula",
      "off-world rooftop under twin moons",
      "transit hub spanning a crystalline canyon",
      "cryo lab humming with frost and indicator lights",
    ],
    lightingPalettes: [
      { lighting: "bioluminescent rim with electric teal fill", palette: "#00FFD1, #6A00F4, #050018, #FF006E" },
      { lighting: "cool starlight with magenta accent practicals", palette: "#7AC9FF, #FF1B6B, #0A0F2C, #FFFFFF" },
      { lighting: "soft volumetric beams cutting through fog", palette: "#A1E8FF, #1B1B3A, #FFB199, #0F0F1E" },
    ],
    shotTypes: ["wide spectacle", "tight tech close-up", "low-angle hero with sky", "POV cockpit", "tracking spacewalk"],
    cameraMoves: ["slow parallax across the horizon", "subject-locked dolly", "drone reveal of vastness", "static composed beat", "rotating orbital shot"],
    characterActions: [
      "subject calibrates a glowing instrument, focused intent",
      "subject stares out at twin moons, wind catching their coat",
      "subject runs through a corridor as warning lights pulse",
      "subject locks eyes with the lens, HUD reflecting in their irises",
      "subject reaches toward a hovering object, fingers haloed in light",
    ],
    wardrobe: [
      "fitted spacesuit with luminous accents",
      "techwear robe over reflective base layer",
      "obsidian flight jacket with embedded LEDs",
      "ceremonial alien garment with metallic embroidery",
    ],
    emotionalPurposes: [
      "convey awe and isolation in equal measure",
      "let the chorus open into infinity",
      "ground the protagonist as the still point of vast motion",
      "communicate hope at the edge of the unknown",
    ],
    promptModifiers: [
      "Denis Villeneuve sci-fi aesthetic, Greig Fraser cinematography, vast scale",
      "Dune meets Blade Runner 2049, painterly atmospheres",
      "anamorphic, deep contrast, motivated source lighting",
    ],
    negativeKeywords: ["cartoonish", "low budget", "flat lighting", "documentary harshness"],
  },
  custom: {
    id: "custom",
    label: "Custom",
    environments: [
      "evocative environment chosen to match the brand brief",
      "location reflecting the lyric's central image",
      "space that contrasts with the emotional state for tension",
      "found environment that grounds the song in reality",
    ],
    lightingPalettes: [
      { lighting: "lighting shaped by the brand direction and emotional arc", palette: "#0B0B0B, #FFFFFF, #FF1B6B, #7B2CBF" },
      { lighting: "single motivated source matched to the lyric mood", palette: "#1A1A1A, #E5C07B, #2C3E50, #C9A66B" },
      { lighting: "ambient practicals shaped to support the brand tone", palette: "#0E0E10, #00E5FF, #FF006E, #F5F5F0" },
    ],
    shotTypes: ["composed wide", "intimate close-up", "tracking medium", "low-angle hero", "static detail"],
    cameraMoves: ["motivated dolly", "handheld for intimacy", "static held composition", "subject-locked orbit", "soft push-in on emotion"],
    characterActions: [
      "subject performs the lyric with clarity of intent",
      "subject moves through the space, reacting to the beat",
      "subject and environment exchange a quiet moment",
      "subject delivers a single decisive gesture",
    ],
    wardrobe: [
      "wardrobe designed to express the brand identity",
      "considered styling that supports the tone",
      "neutral base layer with one statement piece",
    ],
    emotionalPurposes: [
      "serve the brand promise while landing the lyric",
      "let the emotional purpose follow the artist's intent",
      "carry the audience through the section's transformation",
    ],
    promptModifiers: [
      "cinematic music video, considered framing, premium tonality",
      "anamorphic widescreen, motivated lighting, intentional palette",
    ],
    negativeKeywords: ["generic", "stock footage feel", "low quality"],
  },
};

const SECTION_TITLE: Record<string, string> = {
  intro: "Cold Open",
  verse: "Verse Vignette",
  pre_chorus: "Tension Build",
  chorus: "Chorus Detonation",
  bridge: "Bridge Reverie",
  drop: "Drop Sequence",
  breakdown: "Breakdown Interlude",
  outro: "Final Echo",
};

function pseudoRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  const v = arr[Math.floor(rng() * arr.length)];
  if (v === undefined) throw new Error("pick from empty array");
  return v;
}

function intensityToMotion(intensity: number): string {
  if (intensity >= 0.85) return "explosive";
  if (intensity >= 0.65) return "high";
  if (intensity >= 0.4) return "medium";
  if (intensity >= 0.2) return "low";
  return "still";
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function lyricSnippet(lyrics: string | null | undefined, segIndex: number, totalSegs: number): string | null {
  if (!lyrics) return null;
  const lines = lyrics
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("[") && !l.startsWith("("));
  if (lines.length === 0) return null;
  const idx = Math.min(lines.length - 1, Math.floor((segIndex / Math.max(1, totalSegs - 1)) * (lines.length - 1)));
  return lines[idx] ?? null;
}

export interface SceneGenInput {
  projectId: string;
  segment: {
    id: string;
    index: number;
    startSec: number;
    endSec: number;
    section: string;
    emotion: string;
    intensity: number;
  };
  totalSegments: number;
  songTitle: string;
  artistName: string | null;
  visualStyle: VisualStyleId;
  brandDirection: string | null;
  lyrics: string | null;
  seed: string;
}

export function generateScene(input: SceneGenInput): Omit<InsertStoryboardScene, "id"> {
  const preset = VISUAL_STYLES[input.visualStyle] ?? VISUAL_STYLES.custom;
  const rng = pseudoRandom(`${input.seed}-${input.segment.index}-${input.visualStyle}`);

  const env = pick(preset.environments, rng);
  const lit = pick(preset.lightingPalettes, rng);
  const shotType = pick(preset.shotTypes, rng);
  const cameraMovement = pick(preset.cameraMoves, rng);
  const baseAction = pick(preset.characterActions, rng);
  const wardrobe = pick(preset.wardrobe, rng);
  const emotionalPurpose = pick(preset.emotionalPurposes, rng);
  const promptMod = pick(preset.promptModifiers, rng);

  const sectionLabel = SECTION_TITLE[input.segment.section] ?? "Scene";
  const motion = intensityToMotion(input.segment.intensity);
  const snippet = lyricSnippet(input.lyrics, input.segment.index, input.totalSegments);
  const brand = input.brandDirection?.trim() || null;

  const title = `${sectionLabel} — ${input.segment.emotion}`;
  const description = [
    `Plot ${String(input.segment.index + 1).padStart(2, "0")} (${fmtTime(input.segment.startSec)}–${fmtTime(input.segment.endSec)}): ${input.segment.section.replace("_", " ")} energy at ${Math.round(input.segment.intensity * 100)}%.`,
    `${baseAction} inside ${env}.`,
    snippet ? `Lyric anchor: "${snippet}".` : null,
    brand ? `Brand alignment: ${brand}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const aspect = "16:9 anamorphic";
  const aiPromptParts = [
    `${shotType}, ${cameraMovement}, ${aspect}.`,
    `Subject: ${baseAction}. Wardrobe: ${wardrobe}.`,
    `Environment: ${env}.`,
    `Lighting: ${lit.lighting}. Color palette: ${lit.palette}.`,
    `Emotional purpose: ${emotionalPurpose}. Motion intensity: ${motion}.`,
    snippet ? `Lyric: "${snippet}".` : null,
    brand ? `Brand direction: ${brand}.` : null,
    `Style: ${promptMod}. Cinematic music video for "${input.songTitle}"${input.artistName ? ` by ${input.artistName}` : ""}.`,
    `Negative: ${preset.negativeKeywords.join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    projectId: input.projectId,
    segmentId: input.segment.id,
    index: input.segment.index,
    startSec: input.segment.startSec,
    endSec: input.segment.endSec,
    title,
    description,
    shotType,
    cameraMovement,
    location: env,
    lighting: lit.lighting,
    colorPalette: lit.palette,
    wardrobe,
    notes: `Cut on the downbeat. Hold for ${(input.segment.endSec - input.segment.startSec).toFixed(1)}s.`,
    environment: env,
    characterAction: baseAction,
    emotionalPurpose,
    motionIntensity: motion,
    aiPrompt: aiPromptParts,
    locked: false,
  };
}

export const VISUAL_STYLE_OPTIONS = (Object.values(VISUAL_STYLES) as VisualStylePreset[]).map(
  (s) => ({ id: s.id, label: s.label }),
);
