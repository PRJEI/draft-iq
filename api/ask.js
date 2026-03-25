diff --git a/api/ask.js b/api/ask.js
index c6687798ee3be215eea6a12a4f703e7e3c9fae13..148f175e4fc5cddc003a2859686a2580857da882 100644
--- a/api/ask.js
+++ b/api/ask.js
@@ -1,155 +1,337 @@
 import { createClient } from "@supabase/supabase-js";
 
 const supabase = createClient(
   process.env.SUPABASE_URL,
   process.env.SUPABASE_ANON_KEY
 );
 
-// --- Small helper: enforce safe limits and allowed values
-function normalizeFilters(filters) {
-  const allowedPositions = ["QB", "WR", "RB", "TE", "DL", "LB", "CB", "S", "OL"];
+function helpResult() {
+  return {
+    success: true,
+    message: `**NFL Bot Commands:**
 
-  const position =
-    filters.position && allowedPositions.includes(filters.position.toUpperCase())
-      ? filters.position.toUpperCase()
-      : null;
+| Command | Description | Example |
+|---------|-------------|---------|
+| \`teams\` | Show all teams | \`teams\` |
+| \`teams [conference]\` | Filter by AFC or NFC | \`teams afc\` |
+| \`teams [conference] [division]\` | Filter by division | \`teams afc north\` |
+| \`team [name]\` | Search team by name | \`team chiefs\` |
+| \`players\` | Show all players | \`players\` |
+| \`players [position]\` | Filter by position | \`players qb\` |
+| \`roster [team]\` | Get team roster | \`roster chiefs\` |
+| \`search [name]\` | Search players by name | \`search mahomes\` |
+| \`superbowls >[n]\` | Teams with more than n wins | \`superbowls >1\` |
+| \`top [n] players\` | Top n players by years pro | \`top 10 players\` |
+| \`help\` | Show this help | \`help\` |
 
-  const limit = Number.isInteger(filters.limit) ? filters.limit : 10;
-  const safeLimit = Math.min(Math.max(limit, 1), 25); // 1..25
-
-  const minScore =
-    typeof filters.minDraftScore === "number" ? filters.minDraftScore : null;
+**Positions:** QB, RB, WR, TE, OL, DL, LB, CB, S, K, P`,
+    data: null,
+  };
+}
 
-  const sortBy =
-    filters.sortBy === "draft_score" ? "draft_score" : "draft_score";
-  const sortDir = filters.sortDir === "asc" ? "asc" : "desc";
+function parseHelp(input) {
+  const cmd = input.trim().toLowerCase();
+  if (cmd === "help" || cmd === "?") return helpResult();
+  return null;
+}
 
-  return { position, safeLimit, minScore, sortBy, sortDir };
+async function fetchRows(query) {
+  const { data, error } = await query;
+  if (error) throw new Error(error.message);
+  return data ?? [];
 }
 
-// --- Call LLM to extract intent + filters (hybrid approach)
-async function extractIntentAndFilters(question) {
-  const response = await fetch(process.env.LLM_ENDPOINT, {
-    method: "POST",
-    headers: {
-      "Content-Type": "application/json",
-      "Authorization": `Bearer ${process.env.LLM_API_KEY}`
-    },
-    body: JSON.stringify({
-      // This is a generic “chat completion” payload style.
-      // You’ll adjust slightly depending on your LLM provider.
-      messages: [
-        {
-          role: "system",
-          content:
-            "You are an assistant that extracts structured filters from questions about NFL draft prospects. " +
-            "Return ONLY valid JSON with keys: intent, position, limit, minDraftScore, sortBy, sortDir."
-        },
-        { role: "user", content: question }
-      ]
-    })
-  });
-
-  const raw = await response.json();
-
-  // Provider differences: you may need to extract the text differently.
-  // Assume the model response text is in raw.output or raw.choices[0].message.content
-  const text =
-    raw.choices?.[0]?.message?.content ??
-    raw.output ??
-    "";
-
-  // Parse JSON safely
-  try {
-    return JSON.parse(text);
-  } catch {
-    // fallback if model returns bad JSON
-    return { intent: "top_players", limit: 10 };
+async function executeCommand(input) {
+  const cmd = input.trim().toLowerCase();
+  const help = parseHelp(input);
+  if (help) return help;
+
+  if (cmd === "teams") {
+    const teams = await fetchRows(
+      supabase
+        .from("nfl_teams")
+        .select("name, city, abbreviation, conference, division, super_bowl_wins, head_coach")
+        .order("conference", { ascending: true })
+        .order("division", { ascending: true })
+        .order("name", { ascending: true })
+    );
+
+    return {
+      success: true,
+      message: `**All NFL Teams (${teams.length})**`,
+      data: teams,
+      columns: ["name", "city", "abbreviation", "conference", "division", "super_bowl_wins", "head_coach"],
+    };
   }
-}
 
-// --- Build and run safe query
-async function queryPlayers(filters) {
-  let q = supabase.from("players").select("name, position, college, draft_score");
+  const teamsConf = cmd.match(/^teams\s+(afc|nfc)$/);
+  if (teamsConf) {
+    const conference = teamsConf[1].toUpperCase();
+    const teams = await fetchRows(
+      supabase
+        .from("nfl_teams")
+        .select("name, city, abbreviation, division, super_bowl_wins, head_coach")
+        .eq("conference", conference)
+        .order("division", { ascending: true })
+        .order("name", { ascending: true })
+    );
+
+    return {
+      success: true,
+      message: `**${conference} Teams (${teams.length})**`,
+      data: teams,
+      columns: ["name", "city", "abbreviation", "division", "super_bowl_wins", "head_coach"],
+    };
+  }
 
-  if (filters.position) q = q.eq("position", filters.position);
-  if (filters.minScore !== null) q = q.gte("draft_score", filters.minScore);
+  const teamsDiv = cmd.match(/^teams\s+(afc|nfc)\s+(north|south|east|west)$/);
+  if (teamsDiv) {
+    const conference = teamsDiv[1].toUpperCase();
+    const division = `${teamsDiv[2].charAt(0).toUpperCase()}${teamsDiv[2].slice(1)}`;
+    const teams = await fetchRows(
+      supabase
+        .from("nfl_teams")
+        .select("name, city, abbreviation, super_bowl_wins, head_coach, stadium")
+        .eq("conference", conference)
+        .eq("division", division)
+        .order("name", { ascending: true })
+    );
 
-  q = q.order(filters.sortBy, { ascending: filters.sortDir === "asc" });
-  q = q.limit(filters.safeLimit);
+    return {
+      success: true,
+      message: `**${conference} ${division} Teams (${teams.length})**`,
+      data: teams,
+      columns: ["name", "city", "abbreviation", "super_bowl_wins", "head_coach", "stadium"],
+    };
+  }
 
-  const { data, error } = await q;
-  if (error) throw new Error(error.message);
-  return data;
+  const teamSearch = cmd.match(/^team\s+(.+)$/);
+  if (teamSearch) {
+    const term = teamSearch[1];
+    const teams = await fetchRows(
+      supabase
+        .from("nfl_teams")
+        .select("name, city, abbreviation, conference, division, super_bowl_wins, head_coach, stadium, founded_year")
+        .or(`name.ilike.%${term}%,city.ilike.%${term}%`)
+        .order("name", { ascending: true })
+    );
+
+    return {
+      success: true,
+      message:
+        teams.length > 0
+          ? `**Teams matching "${term}" (${teams.length})**`
+          : `No teams found matching "${term}"`,
+      data: teams.length > 0 ? teams : null,
+      columns: ["name", "city", "abbreviation", "conference", "division", "super_bowl_wins", "head_coach"],
+    };
+  }
+
+  if (cmd === "players") {
+    const players = await fetchRows(
+      supabase
+        .from("nfl_players")
+        .select("name, position, jersey_number, team_abbreviation, years_pro, college")
+        .order("years_pro", { ascending: false })
+        .order("name", { ascending: true })
+        .limit(50)
+    );
+
+    const normalized = players.map((p) => ({ ...p, team: p.team_abbreviation }));
+    return {
+      success: true,
+      message: "**NFL Players (showing top 50 by years pro)**",
+      data: normalized,
+      columns: ["name", "position", "jersey_number", "team", "years_pro", "college"],
+    };
+  }
+
+  const playersPos = cmd.match(/^players\s+(qb|rb|wr|te|ol|dl|lb|cb|s|k|p)$/);
+  if (playersPos) {
+    const position = playersPos[1].toUpperCase();
+    const players = await fetchRows(
+      supabase
+        .from("nfl_players")
+        .select("name, jersey_number, team_abbreviation, years_pro, college, draft_year")
+        .eq("position", position)
+        .order("years_pro", { ascending: false })
+        .order("name", { ascending: true })
+    );
+
+    const normalized = players.map((p) => ({ ...p, team: p.team_abbreviation }));
+    return {
+      success: true,
+      message: `**${position} Players (${normalized.length})**`,
+      data: normalized,
+      columns: ["name", "jersey_number", "team", "years_pro", "college", "draft_year"],
+    };
+  }
+
+  const rosterCmd = cmd.match(/^roster\s+(.+)$/);
+  if (rosterCmd) {
+    const term = rosterCmd[1];
+    const teams = await fetchRows(
+      supabase
+        .from("nfl_teams")
+        .select("abbreviation")
+        .or(`name.ilike.%${term}%,city.ilike.%${term}%`)
+        .limit(1)
+    );
+
+    if (teams.length === 0) {
+      return {
+        success: true,
+        message: `No team found matching "${term}". Try \`teams\` to see available team names.`,
+        data: null,
+      };
+    }
+
+    const players = await fetchRows(
+      supabase
+        .from("nfl_players")
+        .select("name, position, jersey_number, years_pro, college")
+        .eq("team_abbreviation", teams[0].abbreviation)
+        .order("position", { ascending: true })
+        .order("name", { ascending: true })
+    );
+
+    if (players.length === 0) {
+      return {
+        success: true,
+        message: `No players found for team "${term}".`,
+        data: null,
+      };
+    }
+
+    return {
+      success: true,
+      message: `**Roster for "${term}" (${players.length} players)**`,
+      data: players,
+      columns: ["name", "position", "jersey_number", "years_pro", "college"],
+    };
+  }
+
+  const searchCmd = cmd.match(/^search\s+(.+)$/);
+  if (searchCmd) {
+    const term = searchCmd[1];
+    const players = await fetchRows(
+      supabase
+        .from("nfl_players")
+        .select("name, position, jersey_number, team_abbreviation, years_pro, college")
+        .ilike("name", `%${term}%`)
+        .order("years_pro", { ascending: false })
+    );
+
+    const normalized = players.map((p) => ({ ...p, team: p.team_abbreviation }));
+    return {
+      success: true,
+      message:
+        normalized.length > 0
+          ? `**Players matching "${term}" (${normalized.length})**`
+          : `No players found matching "${term}"`,
+      data: normalized.length > 0 ? normalized : null,
+      columns: ["name", "position", "jersey_number", "team", "years_pro", "college"],
+    };
+  }
+
+  const sbCmd = cmd.match(/^superbowls\s*>\s*(\d+)$/);
+  if (sbCmd) {
+    const minWins = Number.parseInt(sbCmd[1], 10);
+    const teams = await fetchRows(
+      supabase
+        .from("nfl_teams")
+        .select("name, city, abbreviation, conference, division, super_bowl_wins")
+        .gt("super_bowl_wins", minWins)
+        .order("super_bowl_wins", { ascending: false })
+    );
+
+    return {
+      success: true,
+      message:
+        teams.length > 0
+          ? `**Teams with more than ${minWins} Super Bowl win(s) (${teams.length})**`
+          : `No teams found with more than ${minWins} Super Bowl win(s)`,
+      data: teams.length > 0 ? teams : null,
+      columns: ["name", "city", "abbreviation", "conference", "division", "super_bowl_wins"],
+    };
+  }
+
+  const topCmd = cmd.match(/^top\s+(\d+)\s+players$/);
+  if (topCmd) {
+    const limit = Math.min(Number.parseInt(topCmd[1], 10), 50);
+    const players = await fetchRows(
+      supabase
+        .from("nfl_players")
+        .select("name, position, team_abbreviation, years_pro, college")
+        .order("years_pro", { ascending: false })
+        .limit(limit)
+    );
+
+    const normalized = players.map((p) => ({ ...p, team: p.team_abbreviation }));
+    return {
+      success: true,
+      message: `**Top ${limit} Players by Years Pro**`,
+      data: normalized,
+      columns: ["name", "position", "team", "years_pro", "college"],
+    };
+  }
+
+  return {
+    success: false,
+    message: `Unknown command: "${input}"\n\nType \`help\` to see available commands.`,
+    data: null,
+  };
 }
 
-// --- Call LLM again to explain the returned data
-async function generateExplanation(question, rows) {
-  const response = await fetch(process.env.LLM_ENDPOINT, {
-    method: "POST",
-    headers: {
-      "Content-Type": "application/json",
-      "Authorization": `Bearer ${process.env.LLM_API_KEY}`
-    },
-    body: JSON.stringify({
-      messages: [
-        {
-          role: "system",
-          content:
-            "You are DraftIQ. Explain results clearly and briefly. " +
-            "If the user asked for rankings, summarize top entries and mention draft_score."
-        },
-        {
-          role: "user",
-          content:
-            `User question: ${question}\n\n` +
-            `Database results (JSON): ${JSON.stringify(rows)}\n\n` +
-            "Write a short answer (2-5 sentences) and then list the top results."
-        }
-      ]
-    })
-  });
-
-  const raw = await response.json();
-  return raw.choices?.[0]?.message?.content ?? raw.output ?? "Here are the results.";
+function formatResultAsMarkdown(result) {
+  let output = result.message;
+
+  if (result.data && result.data.length > 0 && result.columns) {
+    output += "\n\n";
+    output += `| ${result.columns.map((col) => col.replaceAll("_", " ").toUpperCase()).join(" | ")} |\n`;
+    output += `| ${result.columns.map(() => "---").join(" | ")} |\n`;
+
+    for (const row of result.data) {
+      output +=
+        `| ${result.columns
+          .map((col) => {
+            const val = row[col];
+            return val !== null && val !== undefined ? String(val) : "-";
+          })
+          .join(" | ")} |\n`;
+    }
+  }
+
+  return output;
 }
 
 export default async function handler(req, res) {
-  // CORS (so local frontend / GitHub Pages can call it)
   res.setHeader("Access-Control-Allow-Origin", "*");
   res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
   res.setHeader("Access-Control-Allow-Headers", "Content-Type");
 
   if (req.method === "OPTIONS") return res.status(200).end();
   if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
 
   try {
-    const { question } = req.body ?? {};
-    if (!question || typeof question !== "string") {
-      return res.status(400).json({ error: "Missing question" });
-    }
-
-    // 1) Extract intent/filters via LLM
-    const parsed = await extractIntentAndFilters(question);
+    const { message, question } = req.body ?? {};
+    const input = typeof message === "string" ? message : question;
 
-    // 2) Normalize + enforce safety
-    const filters = normalizeFilters(parsed);
-
-    // 3) Query Supabase safely
-    const rows = await queryPlayers(filters);
-
-    // (Optional) log it for your project
-    await supabase.from("querylog").insert({
-      question,
-      intent: parsed.intent ?? "unknown",
-      filters: parsed
-    }).catch(() => {});
+    if (!input || typeof input !== "string") {
+      return res.status(400).json({ error: "Missing message" });
+    }
 
-    // 4) Generate explanation
-    const answer = await generateExplanation(question, rows);
+    const result = await executeCommand(input);
+    const markdown = formatResultAsMarkdown(result);
 
-    return res.status(200).json({ answer, rows, intent: parsed.intent ?? "unknown", filters });
-  } catch (err) {
-    return res.status(500).json({ error: err.message });
+    return res.status(200).json({
+      response: markdown,
+      success: result.success,
+      data: result.data ?? null,
+      columns: result.columns ?? null,
+    });
+  } catch (error) {
+    console.error("Ask command error:", error);
+    return res.status(500).json({ error: "Error executing command." });
   }
 }
