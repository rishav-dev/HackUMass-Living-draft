# Running as an app on every device

The Living Draft builds in two ways from the same code:

| Build         | Command                                             | Where the data lives                                                                      |
| ------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Local server  | `npm run dev` or `npm run build && npm start`       | `apps/server/data` on this computer, served by Node                                       |
| On-device app | `npm run build:app` (output in `apps/web/dist-app`) | Inside the app on each device: SQLite (WebAssembly) and files in the device's own storage |

The on-device build runs the exact same server code (routes, engine, SQLite schema and migrations) inside the app. A few small stand-ins in `apps/web/src/device/shims` take the place of Node: a tiny router instead of Express, `sql.js` instead of `node:sqlite`, IndexedDB instead of the file system, and audited pure-JS hashing for the passphrase. Nothing leaves the device unless online illustrations are turned on.

`npm run preview:app` serves the built app at http://localhost:4180 so you can try it with no Node server behind it.

## Installing it today

- **Windows, Mac, Linux, Chromebook:** open the app in Chrome or Edge and choose Install (Settings in the app also has an Install button when the browser offers one). It opens in its own window and works offline.
- **Android:** open it in Chrome and choose Install app.
- **iPhone and iPad:** open it in Safari, tap Share, then Add to Home Screen.

Hosting: the app is a set of static files. Any HTTPS static host works (GitHub Pages, Cloudflare Pages, Netlify). Microphones and installing both need HTTPS, except on `localhost`.

## Watches

`/glance` is a round, watch-sized page: today's memory, tap to hear it, and one button to record a new one. It works in watch browsers that support the microphone (for example Samsung Internet on Galaxy Watch) and as a pinned shortcut on a phone. The manifest also lists it as an app shortcut.

A fully native watch app (watchOS, Wear OS) needs its own small native project. The cleanest route is a companion that talks to the phone app; the data model and API stay the same.

## Meta glasses and earbuds

`/listen` is a spoken conversation that never needs the screen. Pair the glasses with the phone as a Bluetooth headset; their microphone and speakers carry everything. Say a memory and it reads back what it heard and asks whether to keep it, or say "read me one" to hear a memory.

Meta's wearables toolkit for building directly on the glasses is a separate native SDK and isn't needed for this mode.

## When it's time for the stores

Nothing here needs changing first. These are the usual routes:

- **Microsoft Store (Windows):** package the hosted app with PWABuilder (free). It produces an MSIX from the manifest and icons already in `apps/web/public`.
- **Google Play (Android):** PWABuilder or Bubblewrap creates a Trusted Web Activity from the hosted app, or wrap `dist-app` with Capacitor for a fully offline package.
- **Apple App Store (iPhone, iPad, Mac):** wrap `dist-app` with Capacitor (`npx cap add ios`, needs a Mac with Xcode and an Apple developer account). Storage, SQLite and audio all work inside the app. Live speech-to-text inside an iOS app shell needs a native speech plugin; typing and recording work without it.
- **Mac App Store or a direct desktop download:** the same `dist-app` bundle can go inside Capacitor, Tauri or Electron.

Store listings need screenshots, a privacy policy (the in-app privacy notes are a good start) and an account with each store.

## Limits worth knowing

- Photos, recordings and videos live in the device's own storage. Browsers can clear site storage when space runs low unless the app is installed; installed apps are kept. Use Settings, then Download everything, for backups.
- Each device keeps its own notebook. There is no sync between devices yet; export and import are the bridge for now.
- Very large videos are held in memory while the app is open, so keep clips short on phones.
- The natural narrator runs on the graphics chip through WebGPU and downloads about 330 MB the first time it's used. Phones and browsers without WebGPU use the device's own voice instead, with the same pacing. The voice engine's runtime ships inside the app build, so nothing executable is fetched at run time; only the voice model and voice files come from Hugging Face.
