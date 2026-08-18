import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024; // OpenAI audio upload limit
const DEFAULT_MODEL = "whisper-1";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
  }
  if (!file.size) {
    return NextResponse.json({ error: "Audio file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Audio is too large (max 25 MB)." },
      { status: 413 }
    );
  }

  const model =
    (typeof form.get("model") === "string" && String(form.get("model")).trim()) ||
    process.env.OPENAI_TRANSCRIBE_MODEL?.trim() ||
    DEFAULT_MODEL;

  const language =
    (typeof form.get("language") === "string" && String(form.get("language")).trim()) ||
    "en";

  const upstream = new FormData();
  upstream.append("file", file, file.name || "recording.webm");
  upstream.append("model", model);
  if (language) upstream.append("language", language);
  upstream.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: upstream,
  });

  const data = (await response.json().catch(() => null)) as
    | { text?: string; error?: { message?: string } }
    | null;

  if (!response.ok) {
    const message =
      data?.error?.message?.trim() ||
      `OpenAI transcription failed (${response.status}).`;
    return NextResponse.json({ error: message }, { status: response.status });
  }

  const text = typeof data?.text === "string" ? data.text.trim() : "";
  return NextResponse.json({
    text,
    model,
  });
}
