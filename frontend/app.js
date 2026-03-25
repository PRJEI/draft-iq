const button = document.getElementById("loadBtn");
const playerTable = document.getElementById("playerTable");
const playerTableBody = document.getElementById("playerList");

button.addEventListener("click", async () => {
  playerTable.hidden = false;
  playerTableBody.innerHTML = "<tr><td colspan='3'>Loading players...</td></tr>";

  try {
    const response = await fetch(`https://group7project-six.vercel.app/api/getPlayers`);
    const players = await response.json();

    playerTableBody.innerHTML = "";

    players.forEach(p => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${p.name}</td><td>${p.position}</td><td>${p.height_inches}</td><td>${p.team_abbreviation}</td><td>${p.years_pro}</td>`;
      playerTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    playerTableBody.innerHTML = "<tr><td colspan='3'>Failed to load players.</td></tr>";
  }
});
