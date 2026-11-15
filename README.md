# The Living Draft

Your life, one memory at a time.

The Living Draft is a private, voice-first journal for your whole life, laid out like a notebook. You say (or type) a memory from any age, in any order. It keeps your exact words, tidies a reading copy without rewriting your voice, works out roughly when it happened without inventing a date, notices the people in it, and puts it in the right chapter of your life. Tell the same memory again later and both tellings are kept side by side, with what changed laid out plainly.

Built for HackUMass XIV.

## Running it

You need Node.js 22.13 or newer. Nothing else: no database server, no API keys, no paid services.

```bash
npm install
npm run seed
npm run dev
```

Then open http://localhost:5173.

`npm run seed` loads a fictional sample archive (Kinjal, 23) so there's something to explore: 29 memories, several days with more than one thing happening, recordings, capsules and a few threads already found. The sample is locked with the passphrase `kinjal-demo`. Skip the seed to start from an empty archive; onboarding asks you to choose your own passphrase. Running it again asks before replacing an existing archive (`npm run seed -- --force`).

The seed also paints a scene for every day and memory using the free Pollinations image service. The free tier allows about one image every 45 seconds, so that part takes around half an hour. Press Ctrl+C whenever you like (`npm run seed -- --force --no-art` skips it), and `npm run art` fills in whatever is missing later. Anything without a generated scene gets one painted locally in the browser.

`npm run dev` is for working on the code: it compiles every file on the fly and runs React's extra checks, so it's noticeably heavier. For actually using the notebook, run the built version, which opens screens about five times faster:

```bash
npm run serve
```

and open http://localhost:4317. (`npm run serve` is `npm run build` followed by `npm start`.)

Live speech-to-text works in Chrome, Edge and Safari. Every other browser can still record your voice and you can type.

### As an app on your phone, tablet, computer, watch or glasses

`npm run build:app` builds a version that runs entirely on the device, with its own SQLite database and file storage inside the app and no server needed. It installs like an app on Windows, Mac, Android and iPhone, works offline, and has a watch-sized Glance screen and a hands-free mode for earbuds and Meta glasses. `npm run preview:app` lets you try it at http://localhost:4180. See [docs/apps.md](docs/apps.md) for installing it on each device and for the store routes when the time comes.

### Scripts

| Command                           | What it does                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                     | API on :4317 and the web app on :5173, both reloading on change          |
| `npm run seed`                    | Loads the fictional sample archive (add `-- --no-art` to skip scene art) |
| `npm run art`                     | Generates any missing day and memory scenes on the free image tier       |
| `npm run build:app`               | Builds the on-device app (no server) into `apps/web/dist-app`            |
| `npm run preview:app`             | Serves that app build at :4180                                           |
| `npm test`                        | Engine unit tests and API integration tests                              |
| `npm run eval`                    | Runs the hand-labelled evaluation set and prints a report                |
| `npm run typecheck`               | TypeScript across every workspace                                        |
| `npm run lint` / `npm run format` | ESLint and Prettier                                                      |

## What's in it

- **The notebook.** Night-paper pages with ruled lines and a margin, handwritten notes in the margins, a ribbon bookmark, section tabs along the edge and real page turns between them, all sitting on a desk lit by the mood of whatever you're reading.
- **Life Path.** Every year of your life as a glowing point on a path, sized and coloured by what's in it, with the future still dim above. Empty years are waiting, not missing. Open questions sit just above it, including quick "was it when you were 8 or 9?" questions you can answer in one tap.
- **Days.** Every exact date you've remembered, with all the memories from that day.
- **Step back in.** Full-screen. A day, chapter or person opens as a constellation of memories. Pick one and you're there: its own illustration, its own music, the words appearing line by line, photos floating, the recording from that moment playing underneath. Threads to other memories are right there to follow.
- **Chapters.** Each age opens into its own chapter, browsable by season or month, with a recap that only counts what you've actually recorded.
- **Capture.** Talk, type or both. The core listens, then organizes. You review everything before it's saved: the reading copy, when it happened and why it thinks so (or an exact date if you know it), who's in it and what role they played, how it felt then and how it feels now, in any words you like.
- **Honest dates.** "I was eight or nine" lands in both chapters but is stored once. "Sixth grade" is a hint, not a fact. "I don't know when" stays an open question instead of getting a made-up year.
- **Memory Evolution.** Every telling is kept. Differences are labelled (new detail, left out, told differently, possible inconsistency, less certain, corrected, seen differently) and when two tellings disagree you're asked how to keep them, never told which one is true.
- **People.** Clickable names, aliases ("Mom", "Mummy", "my mother"), photos, merging and splitting, and a timeline of every memory a person is in, filtered by whether they were central, supporting or just mentioned.
- **Memory Map and Threads.** A board of memories and the threads between them, filtered by person, feeling, age range or kind of thread. Suggested connections stay dashed until you keep them, and the Threads page lists everything kept or waiting.
- **Compare & Connect.** Put two to six memories side by side and see what they share, with every claim quoted from the source.
- **Ask My Story.** Questions answered only from what you've recorded, with citations, and a plain note about what it can't tell you.
- **Recaps anywhere.** For a chapter, a season, a person or any search, built only from what's recorded and honest about the gaps.
- **Story Books.** A separate space for fiction: scenes written out of order that can float until you know where they go, chapters, a cast, world notes, and threads like foreshadowing and callbacks, with name and echo suggestions. Fiction never mixes with your own memories.
- **Storybook and album.** Your memories in reading order, with chapter notes, your own ordering, read-aloud and a print or PDF version.
- **Weather, place and time of day.** The notebook knows when you're reading it. Lamplight warms the page in the evening and dims at night, the greeting changes ("Rainy evening, Kinjal"), and if you turn weather on, today's sky shows by the date and can drift into the room. A memory with a date and a town shows what the weather records say about that day, labelled as records, not as memory. Each new telling quietly notes when it was written ("first written on a rainy Saturday evening in Amherst").
- **Time capsules, reflections, milestones, search, export, real deletion, and a lock.**

### Look, sound and feel

The desk around the notebook is a live, slow-moving light that takes its colour from the feeling of what you're reading, and the page itself picks up a little of it.

Each memory has its own music, made in the browser: a quiet bed and a gentle motif written for its feeling (warm piano for happy days, sparse piano and low strings for sad ones, a low pulse for angry or anxious ones), varied per memory so no two sound quite the same. It's rendered ahead of time into a seamless loop and crossfades when you move on, so it never stutters or restarts. While you browse it stays barely there; it comes forward when you open a memory or step back into one. Taps make soft notes and a burst of sparks, dragging leaves a glowing trail that sprouts little branches, sections turn like paper, and saving chimes. Memories marked "keep quiet" stay silent.

Reading aloud uses Kokoro, an open voice model that runs on your own machine, so it sounds like a person reading rather than a screen reader. On top of the voice there's a small storyteller: it reads the title, then breathes between sentences, waits longer at the end of a paragraph, lingers after a question or a trailing "…", slows down for quiet or sad memories and lifts a little for happy ones. The music dips under the voice while it reads. There are seven voices to choose from in Settings, and each clip is kept on disk, so a memory you've heard before starts instantly. If the voice isn't downloaded yet, or you'd rather not, it falls back to your device's own voice with the same pacing.

In third person it names you once, then uses your pronouns (or "they"), keeps quoted dialogue exactly as said and gets the grammar right ("I remember" becomes "she remembers").

## How it works

```
Browser (React)                Local server (Express)              Disk
- mic + MediaRecorder   --->   - zod-validated API          --->   - SQLite (node:sqlite)
- speech recognition           - text engine (TypeScript)          - media folder
- Web Audio soundscape         - placement, people, feelings,
                                 matching, evolution, answers
```

The interesting work happens in `packages/engine`. It's plain TypeScript with no model behind it, so every suggestion can point to the exact words it came from, and it's cheap and fast enough to run on every keystroke if needed. See [docs/architecture.md](docs/architecture.md) for the pipeline and data model.

## How well it works

`npm run eval` runs a small, fictional, hand-labelled set. The latest numbers are in [docs/evaluation.md](docs/evaluation.md). In short: when it says two accounts are the same memory it's been right every time on this set, but it misses about a third of real matches; it would rather keep two summers apart than merge them by mistake. The set is small, so treat it as a sanity check.

## Privacy

- Everything lives in `apps/server/data`: one database file and a folder of your files. There's no account and no cloud copy.
- The archive is locked with a passphrase (scrypt hash, http-only session cookie, auto-lock after a period of inactivity you choose). It keeps the app closed to anyone using the browser; the database file itself is not encrypted at rest, so treat it like a diary on your desk.
- Nothing about your memories is sent to an AI service.
- Scene art, if you leave it on, sends a short scene description to Pollinations.ai, built only from scene and mood words (for example "lake at dusk, winter, calm teal light"). Your words, names and dates are never part of it. You can turn it off or change the daily allowance in Settings.
- Weather is off until you turn it on. Then your area, rounded to about 10 km, goes to Open-Meteo (free, no account) for today's weather, town names you search go to its place search, and for a dated memory with a place only that town and date are sent to its weather archive. "Use my location" keeps the rounded coordinates and doesn't send them anywhere else.
- The natural voice downloads once from Hugging Face (about 330 MB) into `apps/server/data/models`. After that, voices are made on this machine; the text being read never leaves it. Finished clips are cached in `apps/server/data/voice`, trimmed to 250 MB and 45 days, and wiped by delete-everything.
- Live transcription uses the browser's own speech service. In Chrome and Edge that sends audio to Google or Microsoft. Typing avoids it.
- Settings has a full export (.zip) and a delete-everything that actually deletes.

## Project layout

```
apps/
  server/   Express API, SQLite schema and migrations, sample archive generator
  web/      React app (Vite, Tailwind, React Router, TanStack Query, React Flow)
packages/
  engine/   reading copy, time clues, people, feelings, matching, version comparison,
            connections, grounded answers, evaluation set
  contracts/ request schemas (zod) and response types shared by both apps
docs/       architecture, evaluation results, demo script
```

## Known limits

- The language rules are tuned for English and for the way people talk about their own past. Unusual phrasing will be missed, and you'll fix it in review.
- School grades are mapped the US way, and flagged as a guess.
- One local profile, one Life Book. The data model has room for more books (and a fiction Story Book), but the app doesn't expose it yet.
- The natural voice needs a one-time 330 MB download. On a laptop the first sentence takes a second or two to start; after that it reads faster than it speaks. In the on-device app (no server) it needs a graphics chip the browser can use (WebGPU); without one, the device's own voice reads instead.
- Handwriting, sync between devices, shared family archives and generated video are future ideas, not features.
