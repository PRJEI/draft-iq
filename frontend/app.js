const button = document.getElementById("loadBtn");
const table = document.getElementById("playerlist");

button.addEventListener("click", async () => {
  table.innerHTML = "<tr><td colspan='3'>Loading players...</td></tr>";

  try {
    const response = await fetch(`https://group7project-six.vercel.app/api/getPlayers`);
    const players = await response.json();

    table.innerHTML = "";

    players.forEach(p => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${p.name}</td><td>${p.position}</td><td>${p.team_abbreviation}</td>`;
      table.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    table.innerHTML = "<tr><td colspan='3'>Failed to load players.</td></tr>";
  }
});
