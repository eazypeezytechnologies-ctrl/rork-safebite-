import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Message {
  role: string;
  content: string | unknown[];
}

function serializeMessages(messages: Message[]): string {
  return messages.map((m) => {
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .map((part: unknown) => {
          if (typeof part === "object" && part !== null && "type" in part) {
            const p = part as Record<string, unknown>;
            if (p.type === "text") return String(p.text ?? "");
            if (p.type === "image") return "[image provided]";
          }
          return "";
        })
        .join("\n");
    }
    return String(m.content);
  }).join("\n\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ result: "AI check is temporarily unavailable. You can still review the ingredients and verify the label." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { type, messages, schema } = body as {
      type: "text" | "object";
      messages: Message[];
      schema?: unknown;
    };

    const systemPrompt = type === "object" && schema
      ? `You are a helpful assistant. Respond ONLY with valid JSON that matches the requested schema. Do not include any prose or markdown outside the JSON object.`
      : `You are a helpful product safety and nutrition assistant for SafeBite.`;

    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as string,
        content: typeof m.content === "string" ? m.content : serializeMessages([m]),
      })),
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        max_tokens: 2000,
        temperature: 0.3,
        ...(type === "object" ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[ai-proxy] OpenAI error:", response.status, err.substring(0, 200));
      return new Response(
        JSON.stringify({ result: "AI check is temporarily unavailable. You can still review the ingredients and verify the label." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";

    if (type === "object") {
      try {
        const parsed = JSON.parse(raw);
        return new Response(JSON.stringify({ result: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(
          JSON.stringify({ result: { error: "AI check is temporarily unavailable." } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ result: raw }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ai-proxy] Unhandled error:", err);
    return new Response(
      JSON.stringify({ result: "AI check is temporarily unavailable. You can still review the ingredients and verify the label." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
