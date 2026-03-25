const askButton = document.getElementById("askBtn");
const commandInput = document.getElementById("commandInput");
const botResponse = document.getElementById("botResponse");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderResponseTable(columns, rows) {
  if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(rows) || rows.length === 0) {
    return "";
  }

  const headerHtml = columns
    .map((column) => `<th>${escapeHtml(column.replaceAll("_", " ").toUpperCase())}</th>`)
    .join("");

  const bodyHtml = rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const value = row?.[column];
          return `<td>${escapeHtml(value ?? "-")}</td>`;
        })
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <div class="table-wrap">
      <table class="bot-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    </div>
  `;
}

function renderMessage(message) {
  return escapeHtml(message || "No response.").replaceAll("\n", "<br>");
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

    const displayMessage = typeof payload.message === "string" ? payload.message : payload.response;
    const messageHtml = `<p class="bot-message">${renderMessage(displayMessage)}</p>`;
    const tableHtml = renderResponseTable(payload.columns, payload.data);

    botResponse.innerHTML = `${messageHtml}${tableHtml}`;
  } catch (error) {
    console.error(error);
    botResponse.innerHTML = "Failed to get response from rule-based bot.";
  }
}

askButton.addEventListener("click", askBot);
commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") askBot();
});
