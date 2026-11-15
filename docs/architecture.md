# Architecture

## Packages

| Package              | Role                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/engine`    | All language work. Pure functions, no I/O, fully unit tested.                                                                                      |
| `packages/contracts` | zod schemas for every request body and TypeScript types for every response. The server validates with them, the web app types its calls with them. |
| `apps/server`        | Express 5 API over SQLite (`node:sqlite`). Owns persistence, media files, accounts, the writing helper and the rules about what can change.        |
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

Those ten steps run on every save. When a writing helper is connected, it goes further.

## The writing helper

`apps/server/src/modules/ai`. Everything goes through one small interface (`runner.ts`: `askJson` and `askText`), so the rest of the code doesn't care whether the model is local or hosted.

- **Local model** (`llm.ts`, `llm-process.ts`). Qwen3 4B Instruct as a 2.4 GB GGUF file, run with node-llama-cpp in a child process at below-normal priority, so the API stays responsive while it thinks. It uses Vulkan, CUDA or Metal when it finds them, otherwise the CPU. Requests queue one at a time; anything the person is waiting on jumps ahead of background work. JSON answers are constrained to a schema by a grammar, so they always parse.
- **Hosted model** (`hosted.ts`). Any service that speaks the OpenAI chat format, with the person's own key. The connection (address, model, key, on or off) lives in the `ai_connection` table, set from Settings; `LIVING_DRAFT_AI_URL`, `LIVING_DRAFT_AI_KEY` and `LIVING_DRAFT_AI_MODEL` are the fallback when there's no row. `withHosted(fallback)` wraps another runner and sends calls to the service while the connection is on: the server registers `withHosted(localRunner)` in `app.ts`, and the on-device app registers `withHosted(noRunner)` in `apps/web/src/device/runtime.ts`, so in the browser the helper is either a hosted model or nothing. JSON calls ask for `json_schema` output and retry with `json_object` plus the schema in the prompt if the service turns that down. The key is never sent back by the API, never exported, and delete-everything clears it.
- **Reading replies** (`json.ts`, `prose.ts`). `readJson` takes the first complete JSON object in a reply and, if the model ran out of room, keeps the parts that finished. `prose.ts` swaps `[2]` references for memory titles, turns dashes into plainer punctuation and works out citations when the model forgets them.
- **Understanding a memory** (`understand.ts`, `jobs.ts`). When capture finishes, a background job asks for notes as JSON: title, summary, people (as mentioned, their name, what they were to the narrator or to someone else in the story, their role, and the sentence that shows it), feelings then and looking back from a fixed list of 28 with a reason, places, milestone, themes, how long it lasted, and two to four follow-up questions. The prompt carries the profile, the people already known, earlier tellings and answered questions, so names resolve to the right person. A second call edits the transcript into a readable story; it streams to the review screen as it's written. The review screen merges both over the rule-based first pass, and the person still decides what's saved.
- **Retrieval** (`retrieve.ts`). Memories, their tellings, people, themes and answered questions are embedded with all-MiniLM-L6-v2 (run locally through transformers.js, cached in `memory_vectors`). A question is matched on those vectors, plus names, roles and kin words ("dad", "father", "papa") with a little typo tolerance.
- **Ask, Compare, Threads** (`ask.ts`, `compare.ts`, `threads.ts`). Ask and Compare send the retrieved memories, numbered, and require answers that cite them, separating what the memories show from what they suggest. Threads run after each save: candidate pairs come from retrieval and shared people or themes, the model judges whether there's a real connection and quotes a line from each side, and a pair is kept as a suggestion only if both quotes are actually in the text.

| Route                                         | What it does                                                         |
| --------------------------------------------- | -------------------------------------------------------------------- |
| `GET /api/ai`                                 | Which model is in use and whether it's ready                         |
| `GET /api/ai/connection`                      | The hosted service, model and whether a key is saved (never the key) |
| `PUT /api/ai/connection`                      | Saves it; leaving out `apiKey` keeps the saved key                   |
| `DELETE /api/ai/connection`                   | Forgets the service and its key                                      |
| `POST /api/ai/connection/test`                | Sends a tiny request and returns what came back                      |
| `POST /api/ai/understand`, `/ask`, `/compare` | Background jobs, polled with `GET /api/ai/jobs/:id`                  |

## Accounts

`modules/auth`. One owner per notebook. Email and password (scrypt), an optional second step, and "keep me signed in", which decides between a 30-day and a 12-hour session.

- **Sign-up** is one call, `POST /api/auth/signup`. Besides the email, password and name it can carry `about` (full name, birthday or age, sex, gender identity, pronouns, birthplace, current town) and `people` (name, kind of person, what they are to you, a note). One request creates the account, the profile (`full_name`, `sex` and `birth_place` came in with migration 010) and a person for each entry, so the notebook already knows them the first time they're mentioned.
- **Two-step sign-in** is a choice, stored in `auth.two_step` (migration 010). When it's on, the address is confirmed with an emailed 6-digit code and devices that aren't trusted ask for a second step: an emailed code, or a TOTP authenticator app. When it's off, the email and password are enough. `POST /api/auth/two-step` switches it, and turning it off needs the password. Without any mail (the on-device app) it's only offered with an authenticator app.
- **Trusted devices** are remembered for 90 days by a random token whose hash is stored in `trusted_devices`. Password reset uses a single-use link that expires. Google sign-in uses OAuth with PKCE when it's configured. Mail goes out over SMTP when `LIVING_DRAFT_SMTP` is set and is otherwise written to `data/outbox`.
- **The sample notebook** has a demo sign-in that only works while the sample is loaded, and its account has two-step off. Signing up over it needs `replaceSample: true`; the sample is first exported to `data/backups/sample-notebook-<time>.zip`, then everything is wiped. `npm run restore-sample` (`apps/server/src/seed/restore.ts`) imports the newest backup and recreates the Kinjal login; it won't overwrite someone's own notebook without `--force`.

## Places and milestones

- **Places** are their own table, linked to memories through `memory_places`. `GET /api/places/map` returns each place with its coordinates and memory ids, plus the ones not on the map yet. `POST /api/places/locate` looks those up by name with Open-Meteo's geocoder, only when the person asks, and sends nothing but the names. `PUT /api/places/:id/location` sets a spot by hand. The sample notebook ships with coordinates for its places.
- **Milestones** take a title, an exact date (`YYYY-MM-DD`), a month (`YYYY-MM`) or an age or age range, a description and linked memories. The `date` column came with migration 009. When there's a date, the ages are worked out from the birthday (or from the current age if there's no birthday), so a milestone always lands in the right year; within a year they're ordered by date.

## Data model

```
profile ─ books ─ memories ─┬─ memory_versions        append-only; each telling, its reading copy and the composed text
                            ├─ temporal_estimates     superseded, never edited; memories also keep how long it lasted
                            ├─ character_mentions ── characters ── character_aliases
                            ├─ emotion_tags           then / now, suggested / user
                            ├─ milestone_memories ── milestones (age range, optional date)
                            ├─ review_items           open differences between tellings
                            ├─ version_resolutions    what the user decided
                            ├─ reflection_memories ── reflections
                            ├─ memory_questions       follow-up questions and the answers given
                            ├─ memory_themes
                            ├─ memory_places ── places (name, kind, region, country, lat, lon)
                            └─ memory_vectors         embeddings for retrieval, rebuilt when the text changes
connections ── connection_endpoints (memory | character | milestone, with evidence spans)
media_assets (owner: memory | capsule | reflection | character | pending)
capsules, analyses (saved answers and comparisons), map_positions
auth (email, password hash, two_step, authenticator secret), sessions, auth_codes, trusted_devices
ai_connection             the hosted model and its key; one row, never exported
```

The profile holds the baseline from sign-up: the name to use, full name, birthday or age, sex, gender identity, pronouns, birthplace and current town, alongside the display and privacy settings.

Rules the server enforces:

- A version row is never updated, except when the user says a telling is really a separate memory, in which case it moves to a new memory intact.
- "Restore" creates a new version that copies an old one, so the history still shows the restore.
- Deleting a memory removes its versions, mentions, tags, links and files. Deleting everything wipes the database tables (the hosted model's key included), the media folder and the narrator's clip cache, and vacuums the file.
- Weather for a memory's day is looked up once and stored in `memory_weather`; changing the memory's place or date clears it so it's fetched again.
- A capsule's text is not returned until it unlocks, and capsules are never counted as events on the Life Path.

## Front end

- Routes are lazy-loaded per screen. The welcome, sign-in and account pages are public; everything else sits behind the account gate. The four-step sign-up (`features/account/SignUpPage.tsx`) stays reachable while the sample notebook is open, since that's when someone wants to start their own.
- The Life Map (`features/life-path/LifePathPage.tsx`) works out each year's height from what's in it: the size of its node, the lines in its label and its milestones, with extra room above the current year for the "you are here" glow. On screens under 640 px the path moves to the left and every label sits on the right. Milestones show as flags beside their year; the editor (`components/milestones/MilestoneDialog.tsx`) is shared with the Capsules page.
- The Threads map is 3d-force-graph on three.js. `features/map/threadStyle.ts` draws each memory as a solid orb with an additive glow and a name label, adds a starfield, colours threads by type and dims everything except the hovered or pinned thread and its two memories. Memories are pulled into height by age and squashed a little in depth, and the camera frames the whole graph from its real extent whenever the filters change. Thin threads are hard to hit with the library's raycaster, so `LifeMapPage.tsx` projects each thread's curve to the screen and treats anything within 12 px as a hover. The glow and label sprites are excluded from raycasting so they don't swallow hovers. Auto-rotation is driven by a small loop that drops to zero the moment anything is hovered, pinned or under the pointer in the details card, and eases back up after a short delay once the pointer has left both.
- Places (`features/places`) has a globe and a flat map over the same data. The globe is globe.gl with dotted country outlines from `world-atlas`, HTML orbs and pulsing rings. The flat map is plain SVG drawn with d3-geo (Natural Earth projection), with d3-zoom for panning and pinching; its orbs and labels keep their size as you zoom, and labels are placed largest first so they never overlap. `placeMap.ts` groups nearby places into one orb, by angle on the globe (wider when zoomed out) and by screen distance on the map, and `PlacePanel.tsx` shows each place's memories, people, ages and feelings.
- Server state lives in TanStack Query. A single `useInvalidateArchive` call refreshes everything derived from memories after a write.
- Motion is gated by a `motion-ok` class on the root element, set from the user's setting and `prefers-reduced-motion`. Scroll-driven reveals use `animation-timeline: view()` behind `@supports`.
- Modals use the native `<dialog>` element with `showModal()`.
- Sound is a small Web Audio engine (`lib/sound/engine.ts`) that synthesizes the ambient pad, weather textures and effects. It starts on the first user gesture, ducks under any recording that's playing, and mutes when the tab is hidden.
- The narrator has three parts. `planReading` in the engine (`packages/engine/src/voice/reading.ts`) turns text into sentence-sized pieces, each with a speed and the pause that should follow it. The voice itself is Kokoro: on the desktop the server runs it with native ONNX Runtime (`modules/voice`, queued one clip at a time, cached as WAV by a hash of voice, speed and text), and in the on-device app a Web Worker runs it on WebGPU. `lib/narration.ts` asks for the next few pieces ahead of time, drops the ones it no longer needs, and schedules them back to back on the sound engine's clock so the pauses land exactly. The device voice (`speechSynthesis`) is the fallback with the same plan.
- Time of day and weather come from `lib/world`. It ticks once a minute, works out dawn, morning, afternoon, evening or night from real sunrise and sunset when it has them, and sets `data-daypart` and `data-weather` on the root element. CSS uses those for the lamplight on the page; the backdrop and the ambient bed read them too.
