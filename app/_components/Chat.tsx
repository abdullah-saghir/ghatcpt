"use client";

// The main chat screen: messages, input, loading/error states, water stats, and new chat.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ChatMessage, GhatReply, ReplyKind } from "@/lib/ghatcpt";
import Tally from "./Tally";

// Must match the server limits in lib/ghatcpt.ts (the server is the real check).
const MAX_CHARS = 2000;
const MAX_MESSAGES = 30;

// ---- Water estimate (every number comes from a published source, see README) ----
// Google (Aug 2025): median Gemini text prompt uses ~0.26 mL of water (on-site cooling only).
const WATER_ML_PER_PROMPT = 0.26;
// OpenAI via Axios (Jul 2025): ChatGPT alone receives ~2.5 billion prompts a day.
const DAILY_PROMPTS = 2_500_000_000;
const LITRES_PER_DAY = (WATER_ML_PER_PROMPT * DAILY_PROMPTS) / 1000; // 650,000 L
const LITRES_PER_SECOND = LITRES_PER_DAY / 86_400; // about 7.5 L
const OLYMPIC_POOL_LITRES = 2_500_000; // 50 m x 25 m x 2 m
const DAYS_PER_POOL = OLYMPIC_POOL_LITRES / LITRES_PER_DAY; // about 3.8 days
const WATER_SOURCE_URL = "https://arxiv.org/abs/2508.15734";
const PROMPTS_SOURCE_URL =
  "https://techcrunch.com/2025/07/21/chatgpt-users-send-2-5-billion-prompts-a-day/";

type UIMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; reply: GhatReply };

const EXAMPLES = [
  "What's 62 + 72?",
  "What's the capital of Australia?",
  "Write my essay on climate change",
];

const KIND_LABEL: Record<ReplyKind, string> = {
  challenge: "Challenge",
  retry: "Try again",
  reveal: "Answer unlocked",
  help: "Help",
};

const KIND_STYLE: Record<ReplyKind, string> = {
  challenge: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  retry: "bg-red-500/15 text-red-700 dark:text-red-400",
  reveal: "bg-green-500/15 text-green-700 dark:text-green-400",
  help: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

// Converts a UI message into the plain text format the API expects.
function toApiMessage(m: UIMessage): ChatMessage {
  if (m.role === "user") return { role: "user", text: m.text };
  const { roast, message, tally } = m.reply;
  const parts = [roast, message];
  if (tally > 0) parts.push(`[Showed ${tally} tally lines for the user to count]`);
  return { role: "assistant", text: parts.filter(Boolean).join("\n").slice(0, MAX_CHARS) };
}

export default function Chat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error]);

  async function requestReply(history: UIMessage[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-MAX_MESSAGES).map(toApiMessage) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.error) {
        setError(data?.error ?? "Something went wrong. Try again.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", reply: data as GhatReply },
      ]);
    } catch {
      setError("Couldn't reach GHATCPT. Check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: UIMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    void requestReply(next);
  }

  function retry() {
    if (!loading) void requestReply(messages);
  }

  function newChat() {
    setMessages([]);
    setInput("");
    setError(null);
  }

  // Enter sends, Shift+Enter makes a new line
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const empty = messages.length === 0;
  const replyCount = messages.filter((m) => m.role === "assistant").length;
  const waterUsed = replyCount * WATER_ML_PER_PROMPT;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <CircleLogo size="sm" />
          <span className="font-semibold tracking-tight">GHATCPT</span>
        </div>
        <div className="flex items-center gap-3">
          {replyCount > 0 && (
            <a
              href={WATER_SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Estimate: about 0.26 mL of data center cooling water per AI reply (Google's published figure). Click for the source."
              className="text-sm text-[var(--muted)] hover:underline"
            >
              💧 {waterUsed.toFixed(2)} mL<span className="hidden sm:inline"> wasted by you</span>
            </a>
          )}
          <button
            onClick={newChat}
            disabled={loading || empty}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface)] disabled:opacity-40"
          >
            New chat
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {empty ? (
            <EmptyState onPick={send} />
          ) : (
            <ul className="flex flex-col gap-6">
              {messages.map((m) => (
                <li key={m.id}>
                  {m.role === "user" ? <UserBubble text={m.text} /> : <AssistantReply reply={m.reply} />}
                </li>
              ))}
            </ul>
          )}

          {loading && (
            <p className="mt-6 animate-pulse text-sm text-[var(--muted)]">GHATCPT is judging your question (and your dependence on AI)...</p>
          )}

          {error && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
              <span>{error}</span>
              <button onClick={retry} className="font-medium underline">
                Try again
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="px-4 pb-4">
        <WaterTicker />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message GHATCPT
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.min(6, input.split("\n").length)}
            maxLength={MAX_CHARS}
            placeholder="Ask anything. Regret it later."
            className="max-h-40 flex-1 resize-none bg-transparent py-1.5 outline-none placeholder:text-[var(--muted)]"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--foreground)] text-[var(--background)] disabled:opacity-30"
          >
            ↑
          </button>
        </form>
        <p className="mt-2 text-center text-xs text-[var(--muted)]">
          GHATCPT can be wrong too. Use your brain, that&apos;s the whole point.
        </p>
      </footer>
    </div>
  );
}

function CircleLogo({ size }: { size: "sm" | "lg" }) {
  const cls = size === "lg" ? "h-12 w-12 border-[3px]" : "h-6 w-6 border-2";
  return (
    <span aria-hidden="true" className={`inline-block shrink-0 rounded-full border-[var(--foreground)] ${cls}`} />
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
      <div className="mb-5">
        <CircleLogo size="lg" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Your brain called. It wants a turn.</h1>
      <p className="mt-2 text-[var(--muted)]">Human intelligence. Unfortunately.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => onPick(ex)}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[80%] whitespace-pre-wrap rounded-3xl bg-[var(--surface)] px-4 py-2.5">{text}</p>
    </div>
  );
}

function AssistantReply({ reply }: { reply: GhatReply }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1">
        <CircleLogo size="sm" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${KIND_STYLE[reply.kind]}`}>
          {KIND_LABEL[reply.kind]}
        </span>
        {reply.roast && <p className="italic text-[var(--accent)]">{reply.roast}</p>}
        <p className="whitespace-pre-wrap leading-relaxed">{reply.message}</p>
        {reply.tally > 0 && <Tally count={reply.tally} />}
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          💧 You just spent ~5 drops of water making an AI think for you. And you&apos;re not special:
          people like you send ChatGPT alone 2.5 billion prompts a day. That&apos;s about{" "}
          {Math.round(LITRES_PER_DAY).toLocaleString("en-US")} litres of water. Every. Single. Day. A full
          Olympic pool drained every {DAYS_PER_POOL.toFixed(1)} days by people who couldn&apos;t be bothered
          to think.{" "}
          <a href={WATER_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">
            Water source
          </a>
          {" · "}
          <a href={PROMPTS_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline">
            Prompts source
          </a>
        </p>
      </div>
    </div>
  );
}

// Live counter: water used by ChatGPT prompts worldwide since this page was opened.
// It lives in its own component so only this line re-renders every second, not the whole chat.
function WaterTicker() {
  const [litres, setLitres] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setLitres(((Date.now() - start) / 1000) * LITRES_PER_SECOND);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p
      className="mx-auto mb-2 w-full max-w-3xl text-center text-xs text-[var(--muted)]"
      title="Estimate: 2.5 billion daily ChatGPT prompts (OpenAI, 2025) x 0.26 mL per prompt (Google, 2025). Cooling water only, so the real number is higher."
    >
      💧 Since you opened this page, lazy people like you have burned through{" "}
      <span className="font-semibold tabular-nums text-[var(--foreground)]">
        {litres.toFixed(1)} litres
      </span>{" "}
      of water asking ChatGPT alone to think for them.
    </p>
  );
}