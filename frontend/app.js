const button = document.getElementById("loadBtn");
const list = document.getElementById("playerList");


button.addEventListener("click", async () => {
  list.innerHTML = "<li>Loading players...</li>";

  try {
    const response = await fetch(`https://group7project-six.vercel.app/api/getPlayers`);
    const players = await response.json();

    list.innerHTML = "";

    players.forEach(p => {
      const li = document.createElement("li");
      li.textContent = `${p.name} | ${p.position} | ${p.team_abbreviation}`;      
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = "<li>Failed to load players.</li>";
  }
});

    

