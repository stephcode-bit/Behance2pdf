import { convertBehanceToPdf, type ProgressStage } from "@/lib/behance-converter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby: 10s, Pro: 60s, Enterprise: 300s. Behance pages can take 30-60s
// for image-heavy projects, so Pro is the realistic minimum.
export const maxDuration = 300;

interface ConvertBody {
  url?: string;
}

const BEHANCE_URL_RE = /^https?:\/\/([a-zA-Z0-9-]+\.)?behance\.net\/.+/i;

function safeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  if (!BEHANCE_URL_RE.test(candidate)) return null;
  return candidate;
}

interface StreamEvent {
  stage: ProgressStage | "queued" | "error";
  message: string;
  percent: number;
  error?: string;
  pdf?: string; // base64-encoded PDF, sent on the final "done" event
  filename?: string;
  size?: number;
}

export async function POST(request: Request) {
  let body: ConvertBody;
  try {
    body = (await request.json()) as ConvertBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawUrl = (body.url ?? "").trim();
  if (!rawUrl) {
    return new Response(JSON.stringify({ error: "Please provide a Behance URL." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = safeUrl(rawUrl);
  if (!url) {
    return new Response(
      JSON.stringify({
        error:
          "That doesn't look like a Behance link. Paste a URL starting with behance.net/gallery/...",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          /* controller may already be closed */
        }
      };

      try {
        const result = await convertBehanceToPdf({
          url,
          onProgress: (p) => send({ stage: p.stage, message: p.message, percent: p.percent }),
        });
        send({
          stage: "done",
          message: "PDF ready!",
          percent: 100,
          pdf: result.pdf.toString("base64"),
          filename: result.filename,
          size: result.size,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ stage: "error", message, percent: 0, error: message });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
