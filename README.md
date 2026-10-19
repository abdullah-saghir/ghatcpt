# GHATCPT

**Human intelligence. Unfortunately.**

An AI that makes you think before it helps. Ask it anything and instead of handing you the answer, it roasts you a little, gives you a do-it-yourself challenge, and only unlocks the answer once you've actually tried.

**Live demo:** https://ghatcpt.vercel.app

Built solo for the **NYLP AI Hackathon 2026** (Building AI-Powered Products).

---

## The problem

AI made it effortless to outsource even tiny bits of thinking. People now ask a chatbot for 62 + 72, simple facts, or whole essays without trying first. Over time this habit can weaken problem-solving and learning, and every one of those prompts also has a real cost in data center water and electricity.

We are not anti-AI. We are against lazy dependence on AI.

## The solution

GHATCPT looks and feels like a normal AI chatbot, so your brain expects a free answer. Then it makes you work:

1. **You ask** anything.
2. **It roasts you** (playfully, only about the habit, never about you as a person) and gives a **challenge that fits the question**:
   - small math: count tally lines (62 + 72 shows 134 lines to count)
   - bigger math: a method to work it out on paper
   - facts: a hint or a guess first
   - concepts: explain it in your own words
   - code: write your attempt first
   - essays: give your outline first
3. **You attempt it.** The AI judges your attempt:
   - correct, close, or a genuine effort: **Answer unlocked** with the real answer and a short explanation
   - lazy ("idk just tell me"): **Try again** with a harder roast and a new challenge
4. **Escape hatch:** after 2 genuine failed tries, or if you mention an accessibility need, it just helps. Serious topics (health, mental health, danger) get no roast at all, only calm support.

Every reply also shows the **water cost** of asking AI, using published figures, so the habit has a visible price.

## Features

- Familiar chat interface (light and dark mode, mobile friendly)
- AI-generated roast + challenge tailored to the question type
- AI evaluation of your attempt (reveal vs retry)
- Tally mark renderer for small arithmetic challenges
- Live water ticker and per-reply water stats with sources
- Loading and error states, new chat, example prompts
- Automatic fallback to a second AI model if the first fails or hits a limit

## AI methodology

- The browser sends the chat history to a server route (`/api/chat`). The browser never talks to the AI provider directly and never sees the API key.
- The server validates the input (message count, length, roles), then calls Google Gemini with:
  - a **system instruction** defining GHATCPT's behavior, challenge types, safety rules and escape hatch (`lib/ghatcpt.ts`)
  - **structured output**: Gemini must reply as JSON matching a schema: `kind` (challenge, retry, reveal, help), `roast`, `message`, and `tally` (number of lines to draw)
  - `store: false`, so conversations are not stored by the provider for later turns, and low "thinking" for faster replies
- The server **validates the AI's reply** before using it (correct kind, non-empty message, tally clamped to 0 to 200). Invalid replies are rejected.
- If the primary model fails (limit hit, overloaded, unavailable) the server automatically retries with a fallback model.
- The UI renders each `kind` differently (labels, tally marks), so the AI output drives the interface, not just plain text.

## AI models and APIs used

| What | Used for |
|---|---|
| Google Gemini API via the official `@google/genai` SDK (Interactions API) | All AI replies |
| `gemini-3.5-flash-lite` | Primary model (fast) |
| `gemini-3.8-flash` | Automatic fallback model |

No other third-party AI APIs are used.

## Water stats: sources and math

All numbers come from the app's code, not from the AI, so the AI cannot invent a statistic.

- **0.26 mL of water per median Gemini text prompt** (about 5 drops): Google, *Measuring the environmental impact of delivering AI at Google Scale*, Aug 2025. https://arxiv.org/abs/2508.15734
- **About 2.5 billion prompts per day sent to ChatGPT**: OpenAI via Axios, July 2025, reported by TechCrunch. https://techcrunch.com/2025/07/21/chatgpt-users-send-2-5-billion-prompts-a-day/
- 2.5 billion x 0.26 mL = **650,000 litres per day**, about 7.5 litres per second.
- An Olympic pool (50 x 25 x 2 m) holds 2,500,000 L, so that is **one pool about every 3.8 days**.

This is a conservative estimate: it counts ChatGPT only, uses Google's low per-prompt figure, and only includes on-site cooling water (not water used to generate the electricity). Real totals are likely higher.

## Tech stack

- Next.js 16 (App Router) + React
- TypeScript
- Tailwind CSS
- Google Gemini API (`@google/genai`)
- Deployed on Vercel

## Safety and ethics

- Roasts target only the habit of outsourcing thinking, never intelligence, looks, identity, religion or anything personal. No profanity.
- Health, mental health, self-harm, danger or grief: no roast, calm support, and a pointer to emergency services or a trusted person where relevant.
- Accessibility: tally marks are hidden from screen readers (so the count is not read out) and instead tell users to ask for accessibility help, which triggers the escape hatch.
- The API key stays server-side (environment variables), never in the code or the browser. `.env.local` is git-ignored.
- Inputs are validated and length-limited. Logs record only model name and status code, never conversations or keys.

## Run it locally

Requirements: Node.js 20 or newer, and a free Gemini API key from https://aistudio.google.com/apikey

```bash
git clone https://github.com/abdullah-saghir/ghatcpt.git
cd ghatcpt
npm install
```

Create a file named `.env.local` in the project root (see `.env.example`):

```
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-3.8-flash
```

Then:

```bash
npm run dev
```

Open http://localhost:3000. Never commit `.env.local`.

## Known limitations

- **Free tier:** the live demo runs on Gemini's free tier, so heavy use can hit daily limits. If you see "GHATCPT is out of breath", wait a minute and try again. Any Gemini API key with higher limits works with no code change.
- AI models can occasionally make mistakes, including in arithmetic or in judging an attempt.
- Chats are not saved. Refreshing the page starts over.
- Water figures are published estimates, not live measurements of this app.

## Future improvements

- Progress tracking ("you solved 7 things yourself this week")
- Difficulty levels and subject modes for students
- More challenge types (diagrams, step-by-step code hints)
- Additional AI providers in the fallback chain

## Screenshots

| Start | Challenge |
|---|---|
| ![Start screen](docs/screenshots/home.png) | ![Challenge with tally marks](docs/screenshots/challenge.png) |

| Answer unlocked | Try again |
|---|---|
| ![Answer unlocked](docs/screenshots/reveal.png) | ![Try again](docs/screenshots/retry.png) |

**Mobile**

<img src="docs/screenshots/mobile.png" alt="Mobile view" width="300" />

## Team

Solo project by **Abdullah Saghir**: idea, product design, development, prompt and AI design, research, testing and deployment.

Developed with Claude (Anthropic) as an AI coding assistant for planning, research and code suggestions. All code was reviewed, run and tested by me.