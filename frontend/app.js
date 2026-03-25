const askButton = document.getElementById("askBtn");
const commandInput = document.getElementById("commandInput");
const botResponse = document.getElementById("botResponse");

function renderMarkdownAsHtml(markdown) {
  const escaped = markdown
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return escaped.replaceAll("\n", "<br>");
}

async function askBot() {
  const message = commandInput.value.trim();

  if (!message) {
    botResponse.innerHTML = "Please type a command first.";
    return;
  }

  botResponse.innerHTML = "Thinking...";

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Request failed");
    }

    botResponse.innerHTML = renderMarkdownAsHtml(payload.response || "No response.");
  } catch (error) {
    console.error(error);
    botResponse.innerHTML = "Failed to get response from rule-based bot.";
  }
}

askButton.addEventListener("click", askBot);
commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") askBot();
});
