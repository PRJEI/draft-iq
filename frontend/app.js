const button = document.getElementById("loadBtn");
const list = document.getElementById("playerList");

button.addEventListener("click", async () => {
  list.innerHTML = "<li>Loading players...</li>";

  try {
    const response = await fetch("/api/getPlayers");
    const players = await response.json();

    list.innerHTML = "";

    players.forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.name} (${p.position}) – Score: ${p.draft_score}`;
      list.appendChild(li);
    });

  } catch (err) {
    list.innerHTML = "<li>Failed to load players.</li>";
  }
});
