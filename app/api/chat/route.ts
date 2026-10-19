// POST /api/chat
// Receives the chat history, asks Gemini for a GHATCPT reply, returns clean JSON.
// If the main model fails (limit hit, unavailable), it automatically tries the fallback model.
// The API key never leaves the server.

import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  SYSTEM_PROMPT,
  REPLY_SCHEMA,
  MAX_TALLY,
  MAX_MESSAGES,
  MAX_CHARS,
  type ChatMessage,
  type GhatReply,
  type ReplyKind,
} from "@/lib/ghatcpt";

const KINDS: ReplyKind[] = ["challenge", "retry", "reveal", "help"];

// Errors where trying another model won't help (bad request, bad or missing key).
const NO_FALLBACK_STATUSES = [400, 401, 403];

// Checks that the request body is a safe, reasonable chat history.
function parseMessages(body: unknown): ChatMessage[] | null {
  if (typeof body !== "object" || body === null) return null;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return null;
  if (messages.length === 0 || messages.length > MAX_MESSAGES) return null;

  for (const m of messages) {
    if (typeof m !== "object" || m === null) return null;
    const { role, text } = m as { role?: unknown; text?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof text !== "string") return null;
    if (text.trim().length === 0 || text.length > MAX_CHARS) return null;
  }

  // The last message must be from the user
  if (messages[messages.length - 1].role !== "user") return null;
  return messages as ChatMessage[];
}

// Checks Gemini's reply has the right shape, and fixes small issues.
function parseReply(raw: string): GhatReply | null {
  try {
    const data = JSON.parse(raw);
    if (!KINDS.includes(data.kind)) return null;
    if (typeof data.message !== "string" || data.message.trim() === "") return null;
    const roast = typeof data.roast === "string" ? data.roast : "";
    let tally = Number.isInteger(data.tally) ? data.tally : 0;
    if (tally < 0 || tally > MAX_TALLY) tally = 0;
    return { kind: data.kind, roast, message: data.message, tally };
  } catch {
    return null;
  }
}

// One call to one Gemini model. Returns the raw JSON text.
async function askModel(ai: GoogleGenAI, model: string, input: string): Promise<string> {
  const interaction = await ai.interactions.create({
    model,
    system_instruction: SYSTEM_PROMPT,
    input,
    store: false,
    generation_config: {
      thinking_level: "low",
      max_output_tokens: 2048,
    },
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: REPLY_SCHEMA,
    },
  });
  return interaction.output_text ?? "";
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  const primary = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const fallback = process.env.GEMINI_FALLBACK_MODEL;
  // Unique list of models to try, in order
  const models = [...new Set([primary, fallback].filter((m): m is string => Boolean(m)))];

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is missing its AI key. The developer messed up, not you." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const messages = parseMessages(body);
  if (!messages) {
    return NextResponse.json(
      { error: `Messages must be 1 to ${MAX_CHARS} characters and the chat under ${MAX_MESSAGES} messages.` },
      { status: 400 }
    );
  }

  // Turn the history into one readable transcript for Gemini.
  const transcript = messages
    .map((m) => `${m.role === "user" ? "USER" : "GHATCPT"}: ${m.text}`)
    .join("\n\n");
  const input = `Conversation so far:\n\n${transcript}\n\nReply to the latest USER message.`;

  const ai = new GoogleGenAI({ apiKey });
  let lastStatus: number | undefined;

  for (const model of models) {
    try {
      const reply = parseReply(await askModel(ai, model, input));
      if (reply) return NextResponse.json(reply);
      // Bad output from this model: try the next one
      lastStatus = 502;
      console.error(`Model ${model} returned an invalid reply. Trying next model if any.`);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      lastStatus = status;
      // Log only the model and status code, never the conversation or the key.
      console.error(`Model ${model} failed. Status: ${status ?? "unknown"}`);
      if (status !== undefined && NO_FALLBACK_STATUSES.includes(status)) break;
    }
  }

  if (lastStatus === 429) {
    return NextResponse.json(
      { error: "GHATCPT is out of breath (free tier limit). Try again in a minute." },
      { status: 429 }
    );
  }
  return NextResponse.json(
    { error: "The AI service had a problem. Try again." },
    { status: 502 }
  );
}