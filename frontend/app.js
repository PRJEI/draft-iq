const button = document.getElementById("loadBtn");
const list = document.getElementById("playerList");

const API_BASE = "https://group7project-1hezh74f8-elis-projects-ece3cb61.vercel.app";

button.addEventListener("click", async () => {
  list.innerHTML = "<li>Loading players...</li>";

  try {
    const response = await fetch(`${API_BASE}/api/getPlayers`);
    const players = await response.json();

    list.innerHTML = "";

    players.forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.name} (${p.position}) – Score: ${p.draft_score}`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = "<li>Failed to load players.</li>";
  }
});

    

