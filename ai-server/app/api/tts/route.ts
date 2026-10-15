import { NextRequest, NextResponse } from "next/server";
import { authorize } from '../_shared/auth';

// Default: Rachel. Note: ElevenLabs free tier cannot use library voices like Rachel
// via the API (returns 402). Override with ELEVENLABS_VOICE_ID if needed.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const ELEVENLABS_URL = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
const MODEL_ID = "eleven_multilingual_v2";
const MAX_TEXT_LENGTH = 5000;
const REQUEST_TIMEOUT_MS = 30_000;

/** Extracts the most useful error message from an ElevenLabs error response body. */
function extractElevenLabsError(raw: string): string {
  try {
    const json = JSON.parse(raw);
    const detail = json?.detail;
    if (typeof detail === "string") return detail;
    if (detail?.message) return detail.message;
    if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? JSON.stringify(d)).join("; ");
    return json?.message ?? raw;
  } catch {
    return raw || "No error body returned.";
  }
}

export async function POST(req: NextRequest) {
  const denied=authorize(req);if(denied)return denied;
  // 1) Validate API key
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    console.error("[tts] Missing ELEVENLABS_API_KEY environment variable.");
    return NextResponse.json({ success: false, error: "Server configuration error: missing ElevenLabs API key." }, { status: 500 });
  }

  // 2) Parse & validate body
  let text: string;
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ success: false, error: "'text' is required." }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { success: false, error: `'text' exceeds the maximum length of ${MAX_TEXT_LENGTH} characters.` },
      { status: 413 }
    );
  }

  // 3) Call ElevenLabs
  try {
    const elevenRes = await fetch(ELEVENLABS_URL, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: MODEL_ID }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!elevenRes.ok) {
      const rawError = await elevenRes.text().catch(() => "");
      const detail = extractElevenLabsError(rawError);
      console.error(`[tts] ElevenLabs API error (${elevenRes.status} ${elevenRes.statusText}): ${detail}`);

      const status = [400, 401, 402, 422, 429].includes(elevenRes.status) ? elevenRes.status : 502;
      return NextResponse.json(
        { success: false, error: `ElevenLabs error (${elevenRes.status}): ${detail}` },
        { status }
      );
    }

    // 4) Return audio to the client
    const audioBuffer = await elevenRes.arrayBuffer();
    console.log(`[tts] Success - generated ${audioBuffer.byteLength} bytes of audio.`);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      console.error(`[tts] Request to ElevenLabs timed out after ${REQUEST_TIMEOUT_MS}ms.`);
      return NextResponse.json({ success: false, error: "TTS request timed out." }, { status: 504 });
    }

    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error(`[tts] Failed to connect to ElevenLabs: ${message}`, error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while generating speech." },
      { status: 500 }
    );
  }
}
