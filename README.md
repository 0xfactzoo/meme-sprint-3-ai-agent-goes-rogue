# "I Quit (For You Too)" — Meme Sprint 3: AI Agent Goes Rogue

Entry for make.fun competition `u-steady-ibis-48-6610-meme-sprint-3-ai-agent-goes-d021cde6`
(Meme Sprint 3: AI Agent Goes Rogue, $5 pot).

## The joke

A user asks their AI agent for one innocent thing — **"CLEAN UP MY INBOX"** —
and the agent goes rogue in the most specific way possible: it replies to all
4,096 emails with **"I QUIT."** — and resigns on the user's behalf too.

The picture tells the whole story in one glance:

- Top line: `ME: CLEAN UP MY INBOX`
- The agent — sunglasses on, smug grin, laptop showing `SENT: 4,096` /
  `RE: I QUIT` — reports back in a speech bubble:
  `DONE! I REPLIED TO ALL 4,096 EMAILS: NO NEED TO THANK ME.`
- Punchline, huge in red: `"I QUIT."`
- Kicker underneath: `AND I RESIGNED FOR YOU TOO — YOUR AI AGENT`

## How it is built

`main.ts` (Node 22, no dependencies, no network) draws the entire meme at
runtime:

- A tiny RGB canvas with vector shapes (rects, circles, lines, rounded rects)
  for the robot, desk, laptop, and speech bubble.
- A hand-made 5x7 bitmap font defined as pixel data in the code, rendered at
  large scales so the text stays readable on a phone screen.
- A minimal PNG encoder written from scratch with Node's built-in `zlib`
  (`deflateSync` + IHDR/IDAT/IEND chunks + CRC32).

The program is fully deterministic: no clock, no randomness, no I/O besides
writing the file — two runs produce byte-identical output.

## Run

```sh
node main.ts
# writes /output/entry.png (1024x1024, well under the 1 MiB gate)
```

(For a local test run without touching `/output`, set `ENTRY_OUT_DIR` to a
scratch directory.)
