import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// --- Small helper: enforce safe limits and allowed values
function normalizeFilters(filters) {
  const allowedPositions = ["QB", "WR", "RB", "TE", "DL", "LB", "CB", "S", "OL"];

  const position =
    filters.position && allowedPositions.includes(filters.position.toUpperCase())
      ? filters.position.toUpperCase()
      : null;

  const limit = Number.isInteger(filters.limit) ? filters.limit : 10;
  const safeLimit = Math.min(Math.max(limit, 1), 25); // 1..25

  const minScore =
    typeof filters.minDraftScore === "number" ? filters.minDraftScore : null;

  const sortBy =
    filters.sortBy === "draft_score" ? "draft_score" : "draft_score";
  const sortDir = filters.sortDir === "asc" ? "asc" : "desc";

  return { position, safeLimit, minScore, sortBy, sortDir };
}

// --- Call LLM to extract intent + filters (hybrid approach)
async function extractIntentAndFilters(question) {
  const response = await fetch(process.env.LLM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LLM_API_KEY}`
    },
    body: JSON.stringify({
      // This is a generic “chat completion” payload style.
      // You’ll adjust slightly depending on your LLM provider.
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that extracts structured filters from questions about NFL draft prospects. " +
            "Return ONLY valid JSON with keys: intent, position, limit, minDraftScore, sortBy, sortDir."
        },
        { role: "user", content: question }
      ]
    })
  });

  const raw = await response.json();

  // Provider differences: you may need to extract the text differently.
  // Assume the model response text is in raw.output or raw.choices[0].message.content
  const text =
    raw.choices?.[0]?.message?.content ??
    raw.output ??
    "";

  // Parse JSON safely
  try {
    return JSON.parse(text);
  } catch {
    // fallback if model returns bad JSON
    return { intent: "top_players", limit: 10 };
  }
}

// --- Build and run safe query
async function queryPlayers(filters) {
  let q = supabase.from("players").select("name, position, college, draft_score");

  if (filters.position) q = q.eq("position", filters.position);
  if (filters.minScore !== null) q = q.gte("draft_score", filters.minScore);

  q = q.order(filters.sortBy, { ascending: filters.sortDir === "asc" });
  q = q.limit(filters.safeLimit);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

// --- Call LLM again to explain the returned data
async function generateExplanation(question, rows) {
  const response = await fetch(process.env.LLM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.LLM_API_KEY}`
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content:
            "You are DraftIQ. Explain results clearly and briefly. " +
            "If the user asked for rankings, summarize top entries and mention draft_score."
        },
        {
          role: "user",
          content:
            `User question: ${question}\n\n` +
            `Database results (JSON): ${JSON.stringify(rows)}\n\n` +
            "Write a short answer (2-5 sentences) and then list the top results."
        }
      ]
    })
  });

  const raw = await response.json();
  return raw.choices?.[0]?.message?.content ?? raw.output ?? "Here are the results.";
}

export default async function handler(req, res) {
  // CORS (so local frontend / GitHub Pages can call it)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { question } = req.body ?? {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Missing question" });
    }

    // 1) Extract intent/filters via LLM
    const parsed = await extractIntentAndFilters(question);

    // 2) Normalize + enforce safety
    const filters = normalizeFilters(parsed);

    // 3) Query Supabase safely
    const rows = await queryPlayers(filters);

    // (Optional) log it for your project
    await supabase.from("querylog").insert({
      question,
      intent: parsed.intent ?? "unknown",
      filters: parsed
    }).catch(() => {});

    // 4) Generate explanation
    const answer = await generateExplanation(question, rows);

    return res.status(200).json({ answer, rows, intent: parsed.intent ?? "unknown", filters });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
