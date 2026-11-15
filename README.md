# The Living Draft

Your life, one memory at a time.

The Living Draft is a private, voice-first journal for your whole life, laid out like a notebook. You say (or type) a memory from any age, in any order. It keeps your exact words, turns them into something you'll want to read later, works out roughly when it happened without inventing a date, notices who was there and what they were to you, and puts it in the right chapter of your life. Tell the same memory again later and both tellings are kept side by side, with what changed laid out plainly.

Built for HackUMass XIV.

## Running it

You need Node.js 22.13 or newer. Nothing else: no database server, no API keys, no paid services.

```bash
npm install
npm run seed
npm run dev
```

Then open http://localhost:5173.

`npm run seed` loads a fictional sample notebook (Kinjal, 23) so there's something to explore: 48 memories from age 4 to 23, a few told more than once, 17 people, 13 places, photos, follow-up questions she answered and 11 threads already found. On the welcome page, press **Explore the demo notebook**, or sign in as `kinjal@example.com` with the password `kinjal-demo`. Running it again asks before replacing an existing notebook (`npm run seed -- --force`).

To try it as yourself, press **Start your notebook**. Signing up takes four short steps: you (name, what to call you, birthday or age, sex, gender identity, pronouns), where you were born and where you live now, the people who matter (family, friends, a partner, pets, mentors), and your email and password. A notebook has one owner, so if the sample is loaded you'll be asked to replace it; a copy is saved to `apps/server/data/backups` first, and `npm run restore-sample` brings it back (add `-- --force` if your own notebook is there by then).

The seed also paints a scene for every memory using the free Pollinations image service. The free tier allows about one image every 45 seconds, so that part takes a while. Press Ctrl+C whenever you like (`npm run seed -- --force --no-art` skips it), and `npm run art` fills in whatever is missing later. Anything without a generated scene gets one painted locally in the browser.

`npm run dev` is for working on the code: it compiles every file on the fly and runs React's extra checks, so it's noticeably heavier. For actually using the notebook, run the built version, which opens screens about five times faster:

```bash
npm run serve
```

and open http://localhost:4317. (`npm run serve` is `npm run build` followed by `npm start`.)

Live speech-to-text works in Chrome, Edge and Safari. Every other browser can still record your voice and you can type.

### The writing helper

Out of the box, a fast rule-based first pass reads every memory (reading copy, dates, people, feelings). For the real thing, open Settings, then **Writing helper**, and press Download. It fetches Qwen3 4B Instruct (2.4 GB, once, from Hugging Face) and runs it on this computer in its own process, on the graphics chip when it can. From then on it:

- edits each memory into a readable story without inventing anything, and gives it a title that gets the point
- works out who was there, their role in this memory and how they relate to you ("his wife" in a story about your music coach is the coach's wife, not yours)
- picks feelings from a wider set (28, from hopeful and relieved to resentful, betrayed and embarrassed), then and looking back, with the reason for each
- notices places, milestones, themes and time clues
- asks two to four follow-up questions you can answer or ignore; answers are kept as part of the memory
- answers questions about your life, compares memories and finds threads between them, always citing the memories it used

It's slow on a laptop. On Intel Iris Xe graphics it writes about 4 to 5 words a second: understanding a new memory takes about a minute in the background, and an answer or comparison one to three minutes. You can keep using the app while it works.

For speed, use a hosted model instead. In Settings, under **Writing helper**, press **Connect a service**, pick Groq, OpenRouter, OpenAI or any other service that speaks the OpenAI chat format, and paste your API key. Answers then come back in seconds. You can switch it off to go back to the model on this computer. The key is kept in the notebook's own database, never shown again and never included in exports. The memory text the helper works on does go to that service to be processed, over HTTPS, and the service can read it while it works, so pick one whose privacy terms you're happy with.

On a server you can set it up with environment variables instead (Settings then shows it as set by the server):

```bash
LIVING_DRAFT_AI_URL=https://api.groq.com/openai/v1
LIVING_DRAFT_AI_KEY=...
LIVING_DRAFT_AI_MODEL=llama-3.3-70b-versatile
```

### Accounts

One notebook, one owner. Sign up with an email and password and choose whether this device should keep you signed in (30 days, otherwise 12 hours). Two-step sign-in is a checkbox on the last signup step: leave it on and you confirm a 6-digit emailed code, and new devices ask for a code (or an authenticator app, if you set one up); untick it, which is handy for testing, and your email and password are all you need. Either way you can change it later in Settings, and turning it off asks for your password. Devices you trust skip the second step for 90 days. "Forgot password" sends a reset link.

Without a mail server, codes and links are written to `apps/server/data/outbox` and printed in the server console. Set `LIVING_DRAFT_SMTP=smtp://user:password@host:587` (and optionally `LIVING_DRAFT_MAIL_FROM`) to send real email. Google sign-in appears when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; the redirect URL is `<your address>/api/auth/google/callback`, and `LIVING_DRAFT_PUBLIC_URL` sets the address when it isn't localhost.

### Running it on GitHub for judges

There are two ways, and both work from a fork with no setup.

- **Codespaces (the full app).** On GitHub, press Code, then Codespaces, then Create. The dev container installs everything, seeds the sample notebook (without art) and starts the built app on port 4317, which opens in the browser. Use a 4-core machine or bigger. The writing helper downloads inside the Codespace like it would on a laptop; for speed, add `LIVING_DRAFT_AI_URL`, `LIVING_DRAFT_AI_KEY` and `LIVING_DRAFT_AI_MODEL` as Codespaces secrets first. `LIVING_DRAFT_SMTP` works the same way.
- **GitHub Pages (the on-device app).** In the repository settings, set Pages to deploy from GitHub Actions. The workflow in `.github/workflows/pages.yml` builds the app that runs entirely in the browser, bundles the sample notebook behind the **Explore the demo notebook** button, and publishes it at `https://<user>.github.io/<repo>/`. Nothing runs on a server there: each visitor's notebook (signup, sign-in and everything else) lives in their own browser. There's no email, so two-step sign-in uses an authenticator app. The writing helper works once you connect a hosted model with your own key in Settings; Groq, OpenRouter and OpenAI all accept calls straight from the browser. Without one, the quick first pass does the reading.

  If you build the Pages version yourself from Git Bash on Windows, put `MSYS_NO_PATHCONV=1` in front of `LIVING_DRAFT_BASE=/living-draft/ npm run build:app`, or Git Bash rewrites the path.

### Android phone and Wear OS watch apps

`apps/android` has a phone app and a native Wear OS watch app for demos on devices like a Galaxy S24 Ultra and Galaxy Watch Ultra. Both connect to the notebook running in a Codespace, so the processing happens there, not on the devices. The watch pairs with a one-time code that the phone app sends over Bluetooth, then shows a memory for today, reads it aloud, saves new memories by voice and answers questions. See [docs/apps.md](docs/apps.md#android-phone-and-wear-os-apps) for building and installing them.

### As an app on your phone, tablet, computer, watch or glasses

`npm run build:app` builds a version that runs entirely on the device, with its own SQLite database and file storage inside the app and no server needed. It installs like an app on Windows, Mac, Android and iPhone, works offline, and has a watch-sized Glance screen and a hands-free mode for earbuds and Meta glasses. `npm run preview:app` lets you try it at http://localhost:4180. See [docs/apps.md](docs/apps.md) for installing it on each device and for the store routes when the time comes.

### Scripts

| Command                           | What it does                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`                     | API on :4317 and the web app on :5173, both reloading on change              |
| `npm run serve`                   | Builds and runs the app the way you'd use it, on :4317                       |
| `npm run seed`                    | Loads the fictional sample notebook (add `-- --no-art` to skip scene art)    |
| `npm run restore-sample`          | Brings back the sample notebook saved when you signed up over it             |
| `npm run art`                     | Generates any missing memory scenes on the free image tier                   |
| `npm run demo:export`             | Packs the current notebook into the zip the on-device app's demo button uses |
| `npm run build:app`               | Builds the on-device app (no server) into `apps/web/dist-app`                |
| `npm run preview:app`             | Serves that app build at :4180                                               |
| `npm test`                        | Engine unit tests and API integration tests                                  |
| `npm run eval`                    | Runs the hand-labelled evaluation set and prints a report                    |
| `npm run typecheck`               | TypeScript across every workspace                                            |
| `npm run lint` / `npm run format` | ESLint and Prettier                                                          |

## What's in it

- **The notebook.** Night-paper pages with ruled lines and a margin, handwritten notes in the margins, a ribbon bookmark, section tabs along the edge and real page turns between them, all sitting on a desk lit by the mood of whatever you're reading.
- **Life.** Search sits at the top, for memories, people, places and feelings, or for asking a question outright. Below it, what you added recently and what you saved, then every year of your life as a glowing point on a path, sized and coloured by what's in it, with the future still dim above. Years space themselves out to fit what's in them, so nothing overlaps, and on a phone the path moves to the side so the labels fit. Open questions sit just above it, including quick "was it when you were 8 or 9?" questions you can answer in one tap.
- **Milestones.** Your own turning points, not a fixed list: "Add a milestone" takes a title, an exact date, a month and year or a rough age (or a range of ages), a few words and the memories that belong with it. Common ones are offered as starting points. They sit on the path in date order beside their year; open one to change it, move it a year earlier or later, or delete it.
- **A memory.** The story first, with room for long ones, then your exact words (a preview, and a full-screen view with every telling separately), the people with their roles and how they relate to you, photos and recordings, the threads it belongs to by the title, and a note at the top when a relationship changed. Bookmark it, answer its follow-up questions, or press Tell more.
- **Capture.** Talk, type or both. You review everything before it's saved: the story, the title, when it happened and why it thinks so (or an exact date if you know it), who's in it and what they were to you, how it felt then and how it feels now. Telling more about an existing memory just adds to it; there's no question about whether it's a retelling.
- **Honest dates.** "I was eight or nine" lands in both chapters but is stored once. "Sixth grade" is a hint, not a fact. "I don't know when" stays an open question instead of getting a made-up year. Not everything happened on one day: a memory can be a moment, a day, a few days, weeks or months, or something that kept happening, and nothing asks you for a date.
- **Memory Evolution.** Every telling is kept. Differences are labelled (new detail, left out, told differently, possible inconsistency, less certain, corrected, seen differently) and when two tellings disagree you're asked how to keep them, never told which one is true.
- **People.** Clickable everywhere. Aliases ("Mom", "Mummy", "my mother"), photos, merging and splitting, how they're related to you and to each other, and a timeline of every memory they're in, filtered by whether they were central, supporting or just mentioned.
- **Places.** Their own section, separate from people, as a 3D globe, a flat map or a list. Every place is a glowing orb sized by how many memories happened there and tinted by how they felt. Places close together share one orb until you zoom in; click one to see each place's memories with their dates, people, feelings and story, and to zoom in until they separate. A place with no coordinates yet can be found with one button, which sends only the place name to Open-Meteo's free place search.
- **Threads, in 3D.** Every memory is a light, arranged by age (higher up is later in life), over a field of stars, with threads drawn as curved, coloured lines between them. Point at a line or a light and the map stops turning at once, the thread and its two memories light up, and a card explains the connection with a quote from each side. The card stays while your pointer is on the line or the card, and the map eases back into motion only after you leave both. Click or tap to keep it open until you close it. Filter by kind of thread or by theme, name every memory or only the connected ones, or see it all as a list.
- **Compare.** Put two to six memories side by side: what's alike, what's different and what changed, each marked as shown by the memories or only suggested, with the passages it's based on.
- **Ask.** Questions answered only from what you've recorded ("How has my perception of failure changed because of my dad?"), with citations and a plain note about what it can't tell you. With the writing helper on, misspellings and different wording find the same memories.
- **Saved.** Bookmarked memories, and comparisons and answers you chose to keep.
- **Recaps anywhere.** For a chapter, a season, a person or any search, built only from what's recorded and honest about the gaps.
- **Story Books.** A separate space for fiction: scenes written out of order that can float until you know where they go, chapters, a cast, world notes, and threads like foreshadowing and callbacks. Fiction never mixes with your own memories.
- **Album.** Your memories in reading order, chapter by chapter, with your own notes and ordering, read-aloud and a print or PDF version.
- **Weather, place and time of day.** The notebook knows when you're reading it. Lamplight warms the page in the evening and dims at night, and if you turn weather on, today's sky shows by the date and can drift into the room. Location is your choice: share it once and keep that town, share it while you're using the app (for when you travel), or don't share it at all. A memory with a date and a town shows what the weather records say about that day, labelled as records, not as memory.
- **Time capsules, reflections, export, real deletion, and a lock.**

### Look, sound and feel

The desk around the notebook is a live, slow-moving light that takes its colour from the feeling of what you're reading, and the page itself picks up a little of it.

Each memory has its own music, made in the browser: a quiet bed and a gentle motif written for its feeling, varied per memory so no two sound quite the same. It's rendered ahead of time into a seamless loop and crossfades when you move on. While you browse it stays barely there; it comes forward when you open a memory. Memories marked "keep quiet" stay silent.

Reading aloud uses Kokoro, an open voice model that runs on your own machine, so it sounds like a person reading rather than a screen reader. It breathes between sentences, waits longer at the end of a paragraph, slows down for quiet or sad memories and lifts a little for happy ones. There are seven voices in Settings, and each clip is kept on disk, so a memory you've heard before starts instantly. If the voice isn't downloaded yet, it falls back to your device's own voice with the same pacing.

## How it works

```
Browser (React)                Local server (Express)                    Disk
- mic + MediaRecorder   --->   - zod-validated API               --->    - SQLite (node:sqlite)
- speech recognition           - text engine (TypeScript)                - media folder
- Web Audio soundscape         - writing helper (llama.cpp, own process) - models
- 3D map and globe (three.js)  - accounts, sessions, mail
```

Two layers read every memory. `packages/engine` is plain TypeScript with no model behind it: it runs instantly on every save, points to the exact words behind each suggestion, and is what the on-device app uses. The writing helper (`apps/server/src/modules/ai`) runs a local language model in a separate process, constrained to a JSON schema, and its notes are merged over the first pass when they arrive. Ask, Compare and Threads retrieve memories with small sentence embeddings plus names, roles and synonyms, then have the model answer only from those. See [docs/architecture.md](docs/architecture.md) for the pipeline and data model.

## How well it works

`npm run eval` runs a small, fictional, hand-labelled set for the rule-based layer. The latest numbers are in [docs/evaluation.md](docs/evaluation.md). In short: when it says two accounts are the same memory it's been right every time on this set, but it misses about a third of real matches; it would rather keep two summers apart than merge them by mistake. The set is small, so treat it as a sanity check.

## Privacy

- Everything lives in `apps/server/data`: one database file, a folder of your files and the downloaded models. There's no cloud copy.
- Your account is local to this notebook. Passwords are hashed with scrypt, sessions are http-only cookies, and the lock and auto-lock still work on top. The database file itself is not encrypted at rest, so treat it like a diary on your desk.
- The writing helper runs on this computer and your memories never leave it, unless you connect a hosted model in Settings (or set `LIVING_DRAFT_AI_URL`). Then the memory text it works on goes to that service over HTTPS, and the service can read it while processing; encrypting it a second time wouldn't change that, since the service has to decrypt it to do the work. Settings says which is in use, and the key is never exported.
- Email goes only where you send it: through your own SMTP server if you set one, otherwise to a local folder. Google sign-in, if set up, only learns that you signed in.
- Scene art, if you leave it on, sends a short scene description to Pollinations.ai, built only from scene and mood words (for example "lake at dusk, winter, calm teal light"). Your words, names and dates are never part of it. You can turn it off or change the daily allowance in Settings.
- Weather and location are off until you choose. Your area, rounded to about 10 km, goes to Open-Meteo (free, no account) for today's weather, town names you search go to its place search, and for a dated memory with a place only that town and date are sent to its weather archive. Putting places on the globe sends only the place names, and only when you press the button.
- What you enter when signing up (birthday, birthplace, the people in your life) stays in the notebook like everything else.
- The natural voice downloads once from Hugging Face (about 330 MB). After that, voices are made on this machine.
- Live transcription uses the browser's own speech service. In Chrome and Edge that sends audio to Google or Microsoft. Typing avoids it.
- Settings has a full export (.zip) and a delete-everything that actually deletes.

## Project layout

```
apps/
  server/   Express API, SQLite schema and migrations, writing helper, accounts, sample notebook
  web/      React app (Vite, Tailwind, React Router, TanStack Query, 3d-force-graph)
packages/
  engine/   reading copy, time clues, people, feelings, matching, version comparison,
            connections, grounded answers, evaluation set
  contracts/ request schemas (zod) and response types shared by both apps
docs/       architecture, evaluation results, apps, demo script
.devcontainer/, .github/workflows/   Codespaces and GitHub Pages
```

## Known limits

- The local writing helper is slow on laptops without a strong graphics card. Everything still works while it catches up, and a hosted endpoint fixes the speed if you're happy to send the text there.
- The on-device app (and so the GitHub Pages version) needs a hosted model and your own key for the writing helper. A model small enough to run well in every browser isn't good enough at this yet.
- The rule-based layer is tuned for English and for the way people talk about their own past. Unusual phrasing will be missed, and you'll fix it in review.
- One owner per notebook. Shared family notebooks and sync between devices are future ideas; export and import are the bridge for now.
- Native watch and glasses apps, handwriting and generated video are future ideas, not features.
