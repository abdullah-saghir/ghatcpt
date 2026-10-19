// Diagnostic: tries each model with both API styles and prints real errors.
// Run with: node --env-file=.env.local scripts/test-gemini.mjs
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("No GEMINI_API_KEY found. Check .env.local");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
const prompt = "Reply with exactly five words saying hello.";

function showError(err) {
  console.log("   status:", err?.status ?? "none");
  console.log("   message:", err?.message);
  // Some SDK errors hide the useful part in body/error fields
  if (err?.body) console.log("   body:", JSON.stringify(err.body).slice(0, 500));
  if (err?.error) console.log("   error:", JSON.stringify(err.error).slice(0, 500));
}

for (const model of models) {
  console.log(`\n=== ${model} ===`);

  // Style 1: classic generateContent
  try {
    const res = await ai.models.generateContent({ model, contents: prompt });
    console.log("generateContent OK:", res.text);
  } catch (err) {
    console.log("generateContent FAILED");
    showError(err);
  }

  // Style 2: new Interactions API
  try {
    const res = await ai.interactions.create({ model, input: prompt });
    console.log("interactions OK:", res.output_text);
  } catch (err) {
    console.log("interactions FAILED");
    showError(err);
  }
}