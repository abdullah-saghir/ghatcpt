"use client";

// The main chat screen: messages, input, loading/error states, and new chat.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ChatMessage, GhatReply, ReplyKind } from "@/lib/ghatcpt";
import Tally from "./Tally";

// Must match the server limits in lib/ghatcpt.ts (the server is the real check).
const MAX_CHARS = 2000;
const MAX_MESSAGES = 30;

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

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <CircleLogo size="sm" />
          <span className="font-semibold tracking-tight">GHATCPT</span>
        </div>
        <button
          onClick={newChat}
          disabled={loading || empty}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface)] disabled:opacity-40"
        >
          New chat
        </button>
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
            <p className="mt-6 animate-pulse text-sm text-[var(--muted)]">GHATCPT is judging you...</p>
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
          GHATCPT can be wrong too. Use your brain, that's the whole point.
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
      </div>
    </div>
  );
}