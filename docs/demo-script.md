# Demo script (about 5 minutes)

Before you start:

- Load a fresh sample notebook: `npm run seed -- --force` (let the scene art finish, or run `npm run art` beforehand), then `npm run serve` and open http://localhost:4317. If you signed up over the sample earlier, `npm run restore-sample` brings it back with its art.
- Connect the writing helper. A hosted model is the one to use in front of people: in Settings, under **Writing helper**, press **Connect a service**, pick Groq (or OpenRouter, or OpenAI), paste your key and press **Test it**. Answers then take seconds. The model on this laptop works too, but takes one to three minutes per answer, so run the Ask question below once beforehand and press Save; you can open the saved answer if the room can't wait.
- Use Chrome so live transcription works, but keep the typed lines below ready in case the room is loud. Turn sound on, with headphones if you can.

Everything in the sample is fictional. Say so if anyone asks.

## 1. Hook (15 s)

Open the welcome page and press **Explore the demo notebook**.

> If you start journaling at 23, you're starting at chapter 23. The Living Draft lets you fill in the earlier chapters, in any order, just by talking.

Point at the search at the top, what was added recently and what's saved, then scroll down the path: one point per year, the dim years above for the future, the flags beside the years for milestones.

## 2. A milestone of your own (20 s)

Press **Add a milestone**. Type "Saw snow for the first time", leave **Roughly, by age** and set 7, and under the memories that belong with it pick "First snow in Queens". Save: the flag appears beside age 7 with the others. Click the flag to open it again, press **A year later** and save to show it move to 8, then open it once more and delete it. Point out the ready-made ideas are only a starting point; any title works, and an exact date or month places it in order within the year.

## 3. One memory, properly (35 s)

Search "team" and open **Not making the team**.

- The story reads like writing. Scroll to **Your exact words** and press **Read everything as you said it** for the transcript it came from, ums and all, with the second telling (Dad explaining the radio, months later) kept separately.
- The people: Coach Brennan as the coach, Dad as central. Tap Dad to show his page and every memory he's in.
- The follow-up questions she answered, and the threads by the title.

## 4. Capture (45 s)

Press **Write** and talk, or type:

> ok so my piano teacher mrs okafor um she made me do scales for like the first twenty minutes every single lesson and I hated it, and her husband was always in the kitchen making tea and he'd give me a biscuit after like a prize for surviving. I was ten or eleven I think

Press **Done, find its place**. While the writing helper reads it, the quick first pass is already there. When it lands, show:

- the title and the story it edited, with nothing added
- Mrs. Okafor as a piano teacher, and "her husband" as her husband, not Kinjal's
- placed at 10 or 11 in both chapters, and "it kept happening" rather than a made-up date
- the feelings, and two or three follow-up questions you can answer or skip

Save it.

## 5. Threads in 3D (30 s)

Open **Threads**. Drag to turn it, scroll to zoom: every memory is a light, higher up is later in life, and the named ones have threads. Pick **Breaking a pattern** and point at the line between "Not making the team" and "Asking for the raise". The map stops turning at once, the thread and its two memories light up and the rest fade, and a card says why they're connected, quoting both: she never asked the coach why; ten years later she asked for a raise and said why. Move the pointer onto the card: it stays. Move away from both and the map eases back into motion. Click the line to keep the card open, then open a memory from it.

## 6. Places (25 s)

Open **Places**. The globe turns slowly; each orb is somewhere she remembers, sized by how many memories happened there and tinted by how they felt. Click the big orb over the US East Coast: the globe zooms in, the orb splits into the towns it was standing in for, and the panel lists each place's memories with their dates, people and feelings. Switch to **Map** for the flat version, zoom with the + button or a pinch, and click the orb over India for Gwalior, where Nani's garden was.

## 7. Ask (30 s)

Open **Ask** and type "How has my perception of failure changed because of my dad?" (or open the one you saved). The answer goes straight at the question: the silent drive after tryouts, Dad laughing at the failed chemistry exam and asking what she'd do differently, why he pushed engineering. Point at the citations, the line between what the memories show and what they only suggest, and what it says it can't tell. Misspell it ("perseption", "changd") to show it finds the same memories.

## 8. Compare (20 s)

From "Not making the team", press the compare button and add "Asking for the raise". Show what's alike, what's different and what changed, each marked as shown or suggested. Press **Save this** and show it under **Saved**.

## 9. Under the hood (20 s)

Open Settings. Show the writing helper: the model on this laptop, or the hosted service with your own key, and the note about what that service can see. Then "See how it works" for the rule-based layer that runs instantly on every save and keeps working without any model, with its evaluation numbers, misses included. Mention two-step sign-in (the switch is right there), and that the same app runs from a GitHub Codespace or entirely in the browser from GitHub Pages.

## Optional: sign up as yourself (40 s)

Press the padlock at the top to sign out, press **Start your notebook** and walk through the four steps: you, where you're from, the people who matter (add Mom and a pet), and how you'll sign in. Untick **Use two-step sign-in** so there's no code to fetch, tick **Replace the sample notebook with mine**, and create it. Use the padlock again, then sign back in with just the email and password. Afterwards, `npm run restore-sample -- --force` puts Kinjal's notebook back.

## If something goes wrong

- No microphone or a noisy room: type. The flow is identical.
- The writing helper is still thinking: keep going with the review screen; the first pass is already there and its notes merge in when they arrive. Or open the saved answer.
- The hosted model says the key was turned down or it's busy: switch it off in Settings and the local model or the first pass takes over.
- Anything stuck: refresh. Nothing is lost; every write is already saved.
