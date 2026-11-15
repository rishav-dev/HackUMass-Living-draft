# Architecture

## Packages

| Package              | Role                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/engine`    | All language work. Pure functions, no I/O, fully unit tested.                                                                                      |
| `packages/contracts` | zod schemas for every request body and TypeScript types for every response. The server validates with them, the web app types its calls with them. |
| `apps/server`        | Express 5 API over SQLite (`node:sqlite`). Owns persistence, media files and the rules about what can change.                                      |
| `apps/web`           | React 19 app. Owns capture, review, presentation, sound and motion.                                                                                |

## The pipeline

1. **Capture.** Audio is recorded with MediaRecorder. Where the browser supports it, the Web Speech API transcribes live. Typing is always available. The original text is stored verbatim; audio is kept unless the user turns that off.
2. **Reading copy** (`cleanup/readingCopy.ts`). Removes fillers ("um", "uh", ", you know,"), stutters and accidental repeats, fixes capitals and closing punctuation. Hedges like "I think" and "maybe" are kept on purpose. A word-level diff is returned so the review screen can show every change.
3. **Time clues** (`temporal/clues.ts`). Exact dates, month and year, season and year, years, stated ages ("when I was 12", "I was eight or nine", "at 22"), birthdays, school grades, life stages, "two winters ago", relative anchors ("before my brother was born") and explicit "I don't know when". Each clue keeps its span in the text.
4. **Placement** (`temporal/estimate.ts`). Clues are combined into an estimate with a precision level (exact, month, year, season and age, age, age range, relative, unknown). Stated ages beat grades, grades and life stages are hints, conflicts are reported rather than resolved silently. Relative anchors are resolved against confirmed milestones and memories, and the result is marked as a suggestion. An estimate spanning up to three ages is shown in each of those chapters but stored once; anything wider waits as an open question.
5. **People** (`people/detect.ts`). Kin terms grouped into canonical keys (mom, mum, mummy, mother → mom), role words (teacher, coach, boss), titled names (Ms. Alvarez) and capitalised names with guards against places, months and sentence starts. "My brother Leo" folds into one person with a relationship. Each person gets a role for this memory (central, supporting, mentioned) from the verbs around their mentions, with the sentence that justified it.
6. **Feelings** (`emotions/detect.ts`). A lexicon of stated feelings and described behaviour, negation-aware, separated into "then" and "now" by present-tense markers in the sentence. Behaviour-based tags get lower confidence.
7. **Matching** (`retrieval/matching.ts`). TF-IDF with query coverage, people overlap, age overlap, season and a small boost for retelling cues. Different ages strongly reduce the score. It returns "likely the same memory" or "related", always with reasons, and never merges.
8. **Evolution** (`evolution/compare.ts`). Two tellings are split into clauses and aligned by term overlap. Each aligned pair is classified as corrected, less certain, possible inconsistency (negation flips or different numbers for the same thing), seen differently, consistent or told differently. Unaligned clauses become new details or, for full retellings, left out.
9. **Connections** (`connections/suggest.ts`). Full circle (being on both sides of the same situation), wish fulfilled, breaking a pattern (staying quiet, then speaking up), repeating pattern and relationship change. Every suggestion quotes a passage from each memory.
10. **Answers** (`ask/answer.ts`). Questions are routed to a character journey, versions, patterns, topic or free-text search. Answers are built from retrieved memories only, every line lists the memories behind it, and gaps and small sample sizes are stated.

## Data model

```
profile ─ books ─ memories ─┬─ memory_versions        append-only; each telling, its reading copy and the composed text
                            ├─ temporal_estimates     superseded, never edited
                            ├─ character_mentions ── characters ── character_aliases
                            ├─ emotion_tags           then / now, suggested / user
                            ├─ milestone_memories ── milestones
                            ├─ review_items           open differences between tellings
                            ├─ version_resolutions    what the user decided
                            └─ reflection_memories ── reflections
connections ── connection_endpoints (memory | character | milestone, with evidence spans)
media_assets (owner: memory | capsule | reflection | character | pending)
capsules, analyses, map_positions
```

Rules the server enforces:

- A version row is never updated, except when the user says a telling is really a separate memory, in which case it moves to a new memory intact.
- "Restore" creates a new version that copies an old one, so the history still shows the restore.
- Deleting a memory removes its versions, mentions, tags, links and files. Deleting everything wipes the database tables, the media folder and the narrator's clip cache, and vacuums the file.
- Weather for a memory's day is looked up once and stored in `memory_weather`; changing the memory's place or date clears it so it's fetched again.
- A capsule's text is not returned until it unlocks, and capsules are never counted as events on the Life Path.

## Front end

- Routes are lazy-loaded per screen.
- Server state lives in TanStack Query. A single `useInvalidateArchive` call refreshes everything derived from memories after a write.
- Motion is gated by a `motion-ok` class on the root element, set from the user's setting and `prefers-reduced-motion`. Scroll-driven reveals use `animation-timeline: view()` behind `@supports`.
- Modals use the native `<dialog>` element with `showModal()`.
- Sound is a small Web Audio engine (`lib/sound/engine.ts`) that synthesizes the ambient pad, weather textures and effects. It starts on the first user gesture, ducks under any recording that's playing, and mutes when the tab is hidden.
- The narrator has three parts. `planReading` in the engine (`packages/engine/src/voice/reading.ts`) turns text into sentence-sized pieces, each with a speed and the pause that should follow it. The voice itself is Kokoro: on the desktop the server runs it with native ONNX Runtime (`modules/voice`, queued one clip at a time, cached as WAV by a hash of voice, speed and text), and in the on-device app a Web Worker runs it on WebGPU. `lib/narration.ts` asks for the next few pieces ahead of time, drops the ones it no longer needs, and schedules them back to back on the sound engine's clock so the pauses land exactly. The device voice (`speechSynthesis`) is the fallback with the same plan.
- Time of day and weather come from `lib/world`. It ticks once a minute, works out dawn, morning, afternoon, evening or night from real sunrise and sunset when it has them, and sets `data-daypart` and `data-weather` on the root element. CSS uses those for the lamplight on the page; the backdrop and the ambient bed read them too.
