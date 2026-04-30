import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
//This is how it will show in the interface for the user
function helpResult() {
  return {
    success: true,
    message: `**NFL Bot Commands:**
| Command | Description | Example |
|---------|-------------|---------|
| \`teams\` | Show all teams | \`teams\` |
| \`teams [conference]\` | Filter by AFC or NFC | \`teams afc\` |
| \`teams [conference] [division]\` | Filter by division | \`teams afc north\` |
| \`team [name]\` | Search team by name | \`team chiefs\` |
| \`players\` | Show all players | \`players\` |
| \`players [position]\` | Filter by position | \`players qb\` |
| \`roster [team]\` | Get team roster | \`roster chiefs\` |
| \`search [name]\` | Search players by name | \`search mahomes\` |
| \`superbowls >[n]\` | Teams with more than n wins | \`superbowls >1\` |
| \`top [n] players\` | Top n players by years pro | \`top 10 players\` |
| \`help\` | Show this help | \`help\` |

**Positions:** QB, RB, WR, TE, OL, DL, LB, CB, S, K, P`,
    data: null,
  };
}

function parseHelp(input) {
  const cmd = input.trim().toLowerCase();
  if (cmd === "help" || cmd === "?") return helpResult();
  return null;
}

async function fetchRows(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function executeCommand(input) {
  const cmd = input.trim().toLowerCase();
  const help = parseHelp(input);
  if (help) return help;

  if (cmd === "teams") {
    const teams = await fetchRows(
      supabase
        .from("nfl_teams")
        .select("name, city, abbreviation, conference, division, super_bowl_wins, head_coach")
        .order("conference", { ascending: true })
        .order("division", { ascending: true })
        .order("name", { ascending: true })
    );

    return {
      success: true,
      message: `**All NFL Teams (${teams.length})**`,
      data: teams,
      columns: ["name", "city", "abbreviation", "conference", "division", "super_bowl_wins", "head_coach"],
    };
  }

  const teamsConf = cmd.match(/^teams\s+(afc|nfc)$/);
  if (teamsConf) {
    const conference = teamsConf[1].toUpperCase();
    const teams = await fetchRows(
      supabase
        .from("nfl_teams")
        .select("name, city, abbreviation, division, super_bowl_wins, head_coach")
        .eq("conference", conference)
        .order("division", { ascending: true })
        .order("name", { ascending: true })
    );

    return {
      success: true,
      message: `**${conference} Teams (${teams.length})**`,
      data: teams,
      columns: ["name", "city", "abbreviation", "division", "super_bowl_wins", "head_coach"],
    };
  }

  const teamsDiv = cmd.match(/^teams\s+(afc|nfc)\s+(north|south|east|west)$/);
  if (teamsDiv) {
    const conference = teamsDiv[1].toUpperCase();
    const division = `${teamsDiv[2].charAt(0).toUpperCase()}${teamsDiv[2].slice(1)}`;
    const teams = await fetchRows(
      supabase
        .from("nfl_teams")
        .select("name, city, abbreviation, super_bowl_wins, head_coach, stadium")
        .eq("conference", conference)
        .eq("division", division)
        .order("name", { ascending: true })
    );

    return {
      success: true,
      message: `**${conference} ${division} Teams (${teams.length})**`,
      data: teams,
      columns: ["name", "city", "abbreviation", "super_bowl_wins", "head_coach", "stadium"],
    };
  }

  const teamSearch = cmd.match(/^team\s+(.+)$/);
  if (teamSearch) {
    const term = teamSearch[1];
    const teams = await fetchRows(
      supabase
        .from("nfl_teams")
        .select("name, city, abbreviation, conference, division, super_bowl_wins, head_coach, stadium, founded_year")
        .or(`name.ilike.%${term}%,city.ilike.%${term}%`)
        .order("name", { ascending: true })
    );

    return {
      success: true,
      message:
        teams.length > 0
          ? `**Teams matching ${term} (${teams.length})**`
          : `No teams found matching **${term}**`,
      data: teams.length > 0 ? teams : null,
      columns: ["name", "city", "abbreviation", "conference", "division", "super_bowl_wins", "head_coach"],
    };
  }

  if (cmd === "players") {
    const players = await fetchRows(
      supabase
        .from("nfl_players")
        .select("name, position, jersey_number, team_abbreviation, years_pro, college")
        .order("years_pro", { ascending: false })
        .order("name", { ascending: true })
        .limit(50)
    );

    const normalized = players.map((p) => ({ ...p, team: p.team_abbreviation }));
    return {
      success: true,
      message: "**NFL Players (showing top 50 by years pro)**",
      data: normalized,
      columns: ["name", "position", "jersey_number", "team", "years_pro", "college"],
    };
  }

  const playersPos = cmd.match(/^players\s+(qb|rb|wr|te|ol|dl|lb|cb|s|k|p)$/);
  if (playersPos) {
    const position = playersPos[1].toUpperCase();
    const players = await fetchRows(
      supabase
        .from("nfl_players")
        .select("name, jersey_number, team_abbreviation, years_pro, college, draft_year")
        .eq("position", position)
        .order("years_pro", { ascending: false })
        .order("name", { ascending: true })
    );

    const normalized = players.map((p) => ({ ...p, team: p.team_abbreviation }));
    return {
      success: true,
      message: `**${position} Players (${normalized.length})**`,
      data: normalized,
      columns: ["name", "jersey_number", "team", "years_pro", "college", "draft_year"],
    };
  }

  const rosterCmd = cmd.match(/^roster\s+(.+)$/);
  if (rosterCmd) {
    const term = rosterCmd[1];
    const teams = await fetchRows(
      supabase
        .from("nfl_teams")
        .select("abbreviation")
        .or(`name.ilike.%${term}%,city.ilike.%${term}%`)
        .limit(1)
    );

    if (teams.length === 0) {
      return {
        success: true,
        message: `No team found matching **${term}**. Try \`teams\` to see available team names.`,
        data: null,
      };
    }

    const players = await fetchRows(
      supabase
        .from("nfl_players")
        .select("name, position, jersey_number, years_pro, college")
        .eq("team_abbreviation", teams[0].abbreviation)
        .order("position", { ascending: true })
        .order("name", { ascending: true })
    );

    if (players.length === 0) {
      return {
        success: true,
        message: `No players found for team **${term}**.`,
        data: null,
      };
    }

    return {
      success: true,
      message: `**Roster for ${term} (${players.length} players)**`,
      data: players,
      columns: ["name", "position", "jersey_number", "years_pro", "college"],
    };
  }

  const searchCmd = cmd.match(/^search\s+(.+)$/);
  if (searchCmd) {
    const term = searchCmd[1];
    const players = await fetchRows(
      supabase
        .from("nfl_players")
        .select("name, position, jersey_number, team_abbreviation, years_pro, college")
        .ilike("name", `%${term}%`)
        .order("years_pro", { ascending: false })
    );

    const normalized = players.map((p) => ({ ...p, team: p.team_abbreviation }));
    return {
      success: true,
      message:
        normalized.length > 0
          ? `**Players matching ${term} (${normalized.length})**`
          : `No players found matching **${term}**`,
      data: normalized.length > 0 ? normalized : null,
      columns: ["name", "position", "jersey_number", "team", "years_pro", "college"],
    };
  }

  const sbCmd = cmd.match(/^superbowls\s*>\s*(\d+)$/);
  if (sbCmd) {
    const minWins = Number.parseInt(sbCmd[1], 10);
    const teams = await fetchRows(
      supabase
        .from("nfl_teams")
        .select("name, city, abbreviation, conference, division, super_bowl_wins")
        .gt("super_bowl_wins", minWins)
        .order("super_bowl_wins", { ascending: false })
    );

    return {
      success: true,
      message:
        teams.length > 0
          ? `**Teams with more than ${minWins} Super Bowl win(s) (${teams.length})**`
          : `No teams found with more than ${minWins} Super Bowl win(s)`,
      data: teams.length > 0 ? teams : null,
      columns: ["name", "city", "abbreviation", "conference", "division", "super_bowl_wins"],
    };
  }

  const topCmd = cmd.match(/^top\s+(\d+)\s+players$/);
  if (topCmd) {
    const limit = Math.min(Number.parseInt(topCmd[1], 10), 50);
    const players = await fetchRows(
      supabase
        .from("nfl_players")
        .select("name, position, team_abbreviation, years_pro, college")
        .order("years_pro", { ascending: false })
        .limit(limit)
    );

    const normalized = players.map((p) => ({ ...p, team: p.team_abbreviation }));
    return {
      success: true,
      message: `**Top ${limit} Players by Years Pro**`,
      data: normalized,
      columns: ["name", "position", "team", "years_pro", "college"],
    };
  }

  return {
    success: false,
    message: `Unknown command: **${input}**\n\nType \`help\` to see available commands.`,
    data: null,
  };
}

function formatResultAsMarkdown(result) {
  let output = result.message;

  if (result.data && result.data.length > 0 && result.columns) {
    output += "\n\n";
    output += `| ${result.columns.map((col) => col.replaceAll("_", " ").toUpperCase()).join(" | ")} |\n`;
    output += `| ${result.columns.map(() => "---").join(" | ")} |\n`;

    for (const row of result.data) {
      output +=
        `| ${result.columns
          .map((col) => {
            const val = row[col];
            return val !== null && val !== undefined ? String(val) : "-";
          })
          .join(" | ")} |\n`;
    }
  }

  return output;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { message, question } = req.body ?? {};
    const input = typeof message === "string" ? message : question;

    if (!input || typeof input !== "string") {
      return res.status(400).json({ error: "Missing message" });
    }

    const result = await executeCommand(input);
    const markdown = formatResultAsMarkdown(result);

    return res.status(200).json({
      response: markdown,
      message: result.message,
      success: result.success,
      data: result.data ?? null,
      columns: result.columns ?? null,
    });
  } catch (error) {
    console.error("Ask command error:", error);
    return res.status(500).json({ error: "Error executing command." });
  }
}
