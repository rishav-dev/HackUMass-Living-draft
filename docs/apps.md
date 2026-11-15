# Running as an app on every device

The Living Draft builds in two ways from the same code:

| Build         | Command                                             | Where the data lives                                                                      |
| ------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Local server  | `npm run dev` or `npm run build && npm start`       | `apps/server/data` on this computer, served by Node                                       |
| On-device app | `npm run build:app` (output in `apps/web/dist-app`) | Inside the app on each device: SQLite (WebAssembly) and files in the device's own storage |

The on-device build runs the exact same server code (routes, engine, SQLite schema and migrations) inside the app. A few small stand-ins in `apps/web/src/device/shims` take the place of Node: a tiny router instead of Express, `sql.js` instead of `node:sqlite`, IndexedDB instead of the file system, and audited pure-JS hashing for the password. Sign-up, sign-in and everything else run there too, so each browser holds its own notebook and account. Nothing leaves the device unless you turn on online illustrations, look up places for the map, or connect a hosted model for the writing helper.

`npm run preview:app` serves the built app at http://localhost:4180 so you can try it with no Node server behind it.

## Installing it today

- **Windows, Mac, Linux, Chromebook:** open the app in Chrome or Edge and choose Install (Settings in the app also has an Install button when the browser offers one). It opens in its own window and works offline.
- **Android:** open it in Chrome and choose Install app.
- **iPhone and iPad:** open it in Safari, tap Share, then Add to Home Screen.

Hosting: the app is a set of static files. Any HTTPS static host works (GitHub Pages, Cloudflare Pages, Netlify). Microphones and installing both need HTTPS, except on `localhost`. The repository's Pages workflow (`.github/workflows/pages.yml`) builds it for a project subpath, adds the sample notebook behind the **Explore the demo notebook** button, and publishes it on every push to `main`. Set `LIVING_DRAFT_BASE` to the subpath (for example `/living-draft/`) if you build it yourself for a host that isn't at the root. From Git Bash on Windows, put `MSYS_NO_PATHCONV=1` in front (`MSYS_NO_PATHCONV=1 LIVING_DRAFT_BASE=/living-draft/ npm run build:app`); otherwise Git Bash turns `/living-draft/` into a Windows path and every asset 404s.

### The writing helper on a static host

There's no server on GitHub Pages, so the local model isn't there. Instead, open Settings, then **Writing helper**, press **Connect a service**, choose Groq, OpenRouter, OpenAI or another OpenAI-compatible service, and paste your own API key. The browser calls that service directly: all three accept requests straight from a web page. Answers come back in seconds. The key is stored in that browser's notebook only, is never shown again and never included in exports, and the memory text the helper works on goes to that service to be processed. Without a key, the quick rule-based reading does everything.

## Watches

`/glance` is a round, watch-sized page: today's memory, tap to hear it, and one button to record a new one. It works in watch browsers that support the microphone (for example Samsung Internet on Galaxy Watch) and as a pinned shortcut on a phone. The manifest also lists it as an app shortcut.

There's also a native Wear OS app; see [Android phone and Wear OS apps](#android-phone-and-wear-os-apps) below.

## Android phone and Wear OS apps

`apps/android` holds two small native apps for demos on an Android phone (tested against a Pixel emulator, built for the Galaxy S24 Ultra) and a Wear OS watch (tested on a Wear OS 5 emulator, the same version as the Galaxy Watch Ultra). Neither does the heavy work: both talk to the full notebook running in a GitHub Codespace, and the writing helper there uses your hosted-model key.

- **Phone app** (`apps/android/phone`). The notebook full-screen, with the microphone, photo uploads and location wired up. Android's in-app browser has no speech recognition, so the app bridges the phone's own recognizer in, and live dictation on the capture screen works as it does in Chrome. On first launch it asks for the notebook's address, unless one was built in.
- **Watch app** (`apps/android/wear`). A memory for today that it reads aloud, saving a memory by voice (it's tidied up by the writing helper a moment later), asking about your life by voice, and a list of recent memories. There's no password on the watch: on the phone, open Settings, then Connect a watch. The phone app sends the one-time code to the watch over Bluetooth, or you can type the six digits on the watch.

### Running them for a demo

1. Start the Codespace (see the README), then make port 4317 public, either in the Ports tab (right-click, Port visibility, Public) or with `gh codespace ports visibility 4317:public -c <codespace-name>`. Its address looks like `https://<codespace-name>-4317.app.github.dev`. Connect a hosted model in Settings so answers come back quickly.
2. Build both apps with that address built in. Android Studio can open `apps/android` directly, or from a terminal:

   ```bash
   cd apps/android
   ./gradlew assembleDebug -PlivingDraftUrl=https://<codespace-name>-4317.app.github.dev
   ```

   The APKs land in `phone/build/outputs/apk/debug/` and `wear/build/outputs/apk/debug/`. Both apps use the same application id, which is what lets the phone hand the pairing code to the watch.

3. Install them. On the phone, turn on Developer options and USB or Wireless debugging, then `adb install phone/build/outputs/apk/debug/phone-debug.apk`. On the watch, turn on Developer options, then ADB debugging and Wireless debugging; pair with `adb pair <ip>:<port>` using the code the watch shows, then `adb connect <ip>:<port>` and `adb -s <ip>:<port> install wear/build/outputs/apk/debug/wear-debug.apk`.
4. Open the phone app, sign in, go to Settings, then Connect a watch, and open the app on the watch.

The Codespace has to be running during the demo, and it stops after a while without use (30 minutes by default), so open it shortly beforehand. For a quick test without GitHub, build with `-PlivingDraftUrl=http://<this computer's address>:4317` and run `npm run serve` with `LIVING_DRAFT_HOST=0.0.0.0` on the same Wi-Fi.

On some phones the speech recognizer and the voice recording can't share the microphone, so dictation works but the saved audio clip comes out silent. Typing and dictation are unaffected.

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
- The writing helper needs either the server or a hosted model with your own key (see above). Without one, the on-device app uses the quick rule-based reading.
- Accounts work, but there's no email on the device: sign-up confirms nothing by mail, "forgot password" can't send a link, and two-step sign-in means setting up an authenticator app in Settings.
- Each device keeps its own notebook. There is no sync between devices yet; export and import are the bridge for now.
- Very large videos are held in memory while the app is open, so keep clips short on phones.
- The natural narrator runs on the graphics chip through WebGPU and downloads about 330 MB the first time it's used. Phones and browsers without WebGPU use the device's own voice instead, with the same pacing. The voice engine's runtime ships inside the app build, so nothing executable is fetched at run time; only the voice model and voice files come from Hugging Face.
