const API_BASE = "/api";

const elements = {
connectionStatus: document.getElementById("connection-status"),
totalTickets: document.getElementById("total-tickets"),
openTickets: document.getElementById("open-tickets"),
progressTickets: document.getElementById("progress-tickets"),
resolvedTickets: document.getElementById("resolved-tickets"),
tableBody: document.getElementById("tickets-table-body"),
ticketCount: document.getElementById("ticket-count"),
search: document.getElementById("ticket-search"),
statusFilter: document.getElementById("status-filter"),
refreshButton: document.getElementById("refresh-tickets"),
openFormButton: document.getElementById("open-ticket-form"),
dialog: document.getElementById("ticket-dialog"),
closeFormButton: document.getElementById("close-ticket-form"),
cancelFormButton: document.getElementById("cancel-ticket"),
form: document.getElementById("ticket-form"),
submitButton: document.getElementById("submit-ticket"),
formMessage: document.getElementById("form-message"),
toast: document.getElementById("toast"),
};

let tickets = [];
let toastTimer;

const allowedStatuses = ["Open", "In Progress", "Resolved", "Closed"];
const allowedPriorities = ["Low", "Medium", "High", "Critical"];

async function apiRequest(path, options = {}) {
const response = await fetch(`${API_BASE}${path}`, {
...options,
headers: {
Accept: "application/json",
...(options.body ? { "Content-Type": "application/json" } : {}),
...options.headers,
},
});

const text = await response.text();
let data = null;

if (text) {
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`The API returned an unexpected response (${response.status}).`);
    }
}

if (!response.ok) {
    throw new Error(
        data?.error || `The request failed with HTTP ${response.status}.`
    );
}

return data;

}
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}

function getStatusClass(status) {
return `status-${String(status).toLowerCase().replace(/\s+/g, "-")}`;
}

function getPriorityClass(priority) {
return `priority-${String(priority).toLowerCase()}`;
}

function showToast(message, type = "success") {
clearTimeout(toastTimer);

elements.toast.textContent = message;
elements.toast.className = `toast visible${type === "error" ? " error" : ""}`;

toastTimer = setTimeout(() => {
    elements.toast.className = "toast";
}, 4000);

}

function setConnectionStatus(connected) {
elements.connectionStatus.textContent = connected
? "Connected"
: "Connection unavailable";

const dot = document.querySelector(".status-dot");

if (dot) {
    dot.style.background = connected ? "#10b981" : "#ef4444";
    dot.style.boxShadow = connected
        ? "0 0 0 4px rgb(16 185 129 / 12%)"
        : "0 0 0 4px rgb(239 68 68 / 12%)";
}

}

function renderStatistics() {
elements.totalTickets.textContent = tickets.length;

elements.openTickets.textContent = tickets.filter(
    ticket => ticket.status === "Open"
).length;

elements.progressTickets.textContent = tickets.filter(
    ticket => ticket.status === "In Progress"
).length;

elements.resolvedTickets.textContent = tickets.filter(
    ticket => ticket.status === "Resolved"
).length;

}

function getFilteredTickets() {
const query = elements.search.value.trim().toLowerCase();
const status = elements.statusFilter.value;

return tickets.filter(ticket => {
    const searchableText = [
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.created_by,
        ticket.category,
        ticket.priority,
        ticket.status,
    ].join(" ").toLowerCase();

    const matchesSearch = searchableText.includes(query);
    const matchesStatus = status === "All" || ticket.status === status;

    return matchesSearch && matchesStatus;
});

}

function renderTickets() {
const filteredTickets = getFilteredTickets();

elements.ticketCount.textContent =
    `Showing ${filteredTickets.length} of ${tickets.length} tickets`;

if (filteredTickets.length === 0) {
    elements.tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                ${
                    tickets.length === 0
                        ? "No tickets found. Create your first support ticket."
                        : "No tickets match your search or selected filter."
                }
            </td>
        </tr>
    `;
    return;
}

elements.tableBody.innerHTML = filteredTickets.map(ticket => `
    <tr>
        <td>
            <span class="ticket-title" title="${escapeHTML(ticket.title)}">
                ${escapeHTML(ticket.title)}
            </span>
            <span class="ticket-id">#${escapeHTML(ticket.id)}</span>
        </td>
        <td>
            <span class="requester">${escapeHTML(ticket.created_by)}</span>
        </td>
        <td>${escapeHTML(ticket.category)}</td>
        <td>
            <span class="priority ${getPriorityClass(ticket.priority)}">
                ${escapeHTML(ticket.priority)}
            </span>
        </td>
        <td>
            <span class="status-badge ${getStatusClass(ticket.status)}">
                ${escapeHTML(ticket.status)}
            </span>
        </td>
        <td>
            <label class="visually-hidden" for="status-${escapeHTML(ticket.id)}">
                Update status for ticket ${escapeHTML(ticket.id)}
            </label>
            <select
                class="status-select"
                id="status-${escapeHTML(ticket.id)}"
                data-ticket-id="${escapeHTML(ticket.id)}"
                aria-label="Update status for ticket ${escapeHTML(ticket.id)}"
            >
                ${allowedStatuses.map(status => `
                    <option
                        value="${status}"
                        ${ticket.status === status ? "selected" : ""}
                    >${status}</option>
                `).join("")}
            </select>
        </td>
    </tr>
`).join("");

}

async function loadTickets(showError = true) {
elements.refreshButton.disabled = true;
elements.refreshButton.textContent = "Loading...";

try {
    const result = await apiRequest("/tickets");

    if (!Array.isArray(result)) {
        throw new Error("The API did not return a valid ticket list.");
    }

    tickets = result;
    setConnectionStatus(true);
    renderStatistics();
    renderTickets();
} catch (error) {
    setConnectionStatus(false);

    if (showError) {
        showToast(`Could not load tickets: ${error.message}`, "error");
    }

    elements.tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                Unable to load tickets. Check the API connection and try again.
            </td>
        </tr>
    `;

    elements.ticketCount.textContent = "Ticket data unavailable";
} finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.innerHTML = '<span aria-hidden="true">↻</span> Refresh';
}

}

function openTicketForm() {
elements.form.reset();
elements.formMessage.textContent = "";
elements.formMessage.className = "form-message";
elements.dialog.showModal();
}

function closeTicketForm() {
elements.dialog.close();
}

async function createTicket(event) {
event.preventDefault();

const formData = new FormData(elements.form);

const payload = {
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    priority: String(formData.get("priority") || "Medium"),
    created_by: String(formData.get("created_by") || "").trim(),
};

if (!payload.title || !payload.category || !payload.created_by) {
    elements.formMessage.textContent =
        "Please complete the title, category, and requester name.";
    elements.formMessage.className = "form-message error";
    return;
}

if (!allowedPriorities.includes(payload.priority)) {
    elements.formMessage.textContent = "Please select a valid priority.";
    elements.formMessage.className = "form-message error";
    return;
}

elements.submitButton.disabled = true;
elements.submitButton.textContent = "Creating...";

try {
    const ticket = await apiRequest("/tickets", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    tickets.push(ticket);
    renderStatistics();
    renderTickets();
    closeTicketForm();

    showToast(`Ticket #${ticket.id} created successfully.`);
} catch (error) {
    elements.formMessage.textContent = error.message;
    elements.formMessage.className = "form-message error";
} finally {
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = "Create Ticket";
}

}

async function updateTicketStatus(ticketId, newStatus, selectElement) {
if (!allowedStatuses.includes(newStatus)) {
showToast("Please select a valid ticket status.", "error");
await loadTickets(false);
return;
}

selectElement.disabled = true;

try {
    const updatedTicket = await apiRequest(
        `/tickets/${encodeURIComponent(ticketId)}/status`,
        {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus }),
        }
    );

    tickets = tickets.map(ticket =>
        ticket.id === updatedTicket.id ? updatedTicket : ticket
    );

    renderStatistics();
    renderTickets();

    showToast(`Ticket #${updatedTicket.id} updated to ${updatedTicket.status}.`);
} catch (error) {
    showToast(`Could not update ticket: ${error.message}`, "error");
    await loadTickets(false);
}

}

elements.refreshButton.addEventListener("click", () => loadTickets());
elements.openFormButton.addEventListener("click", openTicketForm);
elements.closeFormButton.addEventListener("click", closeTicketForm);
elements.cancelFormButton.addEventListener("click", closeTicketForm);
elements.form.addEventListener("submit", createTicket);

elements.search.addEventListener("input", renderTickets);
elements.statusFilter.addEventListener("change", renderTickets);

elements.tableBody.addEventListener("change", event => {
const selectElement = event.target;

if (!selectElement.matches(".status-select")) {
    return;
}

updateTicketStatus(
    Number(selectElement.dataset.ticketId),
    selectElement.value,
    selectElement
);

});

elements.dialog.addEventListener("click", event => {
if (event.target === elements.dialog) {
closeTicketForm();
}
});

loadTickets();
