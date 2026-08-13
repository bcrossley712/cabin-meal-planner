/**
 * render.js
 * Pure(ish) rendering: takes the current state and produces HTML strings.
 * No event listeners are attached here — main.js wires all interaction via
 * event delegation on #app, so re-rendering never has to worry about
 * re-attaching handlers.
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .toUpperCase();
}

// Editing requires both: passcode unlocked on this device, AND a
// connection (offline is always view-only, regardless of lock state —
// see PROJECT_NOTES.md "Offline behavior").
function canEdit(state) {
  return state.unlocked && state.online;
}

function lockToggleHTML(state, compact) {
  const { unlocked, online } = state;
  const showUnlocked = unlocked && online;
  let label = "Locked";
  if (compact) label = "";
  else if (!online) label = "Offline";
  else if (unlocked) label = "Editing";

  return `
    <button type="button" class="lock-toggle ${showUnlocked ? "unlocked" : ""}" data-action="toggle-lock" ${
    online ? "" : "disabled"
  }>
      <span aria-hidden="true">${showUnlocked ? "🔓" : "🔒"}</span>
      ${label ? `<span>${label}</span>` : ""}
    </button>`;
}

function renderApp(state) {
  const app = document.getElementById("app");
  if (state.view.screen === "trip" && state.view.tripId) {
    const trip = state.data.trips.find((t) => t.id === state.view.tripId);
    if (trip) {
      app.innerHTML = renderTripScreen(state, trip);
      return;
    }
    // trip no longer exists (e.g. deleted elsewhere) — fall back to list
    state.view = { screen: "list", tripId: null };
  }
  app.innerHTML = renderTripList(state);
}

function renderTripList(state) {
  const trips = state.data.trips;

  const cards = trips
    .map((t) => {
      const dayCount = t.days.length;
      return `
      <div class="trip-card">
        <button type="button" class="trip-card-main" data-action="select-trip" data-trip-id="${t.id}">
          <span class="trip-icon-badge" aria-hidden="true">🏕️</span>
          <span style="flex:1; min-width:0;">
            <span class="trip-card-name" style="display:block;">${escapeHtml(t.name)}</span>
            <span class="trip-card-sub">${dayCount} day${dayCount !== 1 ? "s" : ""} planned</span>
          </span>
        </button>
        ${
          canEdit(state)
            ? `<button type="button" class="icon-btn danger-hover" data-action="delete-trip" data-trip-id="${t.id}" aria-label="Delete trip">🗑</button>`
            : ""
        }
      </div>`;
    })
    .join("");

  const addForm = state.ui.addingTrip
    ? `
      <div class="inline-form">
        <input type="text" id="new-trip-name" class="text-input dark" placeholder="e.g. Thanksgiving Cabin" autocomplete="off" autofocus />
        <button type="button" class="btn-primary" data-action="submit-add-trip">Add</button>
        <button type="button" class="icon-btn" data-action="cancel-add-trip" aria-label="Cancel">&times;</button>
      </div>`
    : `<button type="button" class="dashed-btn" data-action="open-add-trip">+ New trip</button>`;

  return `
    <div class="screen-pad">
      <div class="topbar" style="padding:4px 0 0;">
        <p class="eyebrow" style="margin:0;">CABIN LOGBOOK</p>
        ${lockToggleHTML(state, false)}
      </div>
      <h1 class="topbar-title" style="margin:4px 0 20px;">Your trips</h1>

      ${trips.length === 0 ? `<p class="empty-state">No trips yet — add one below.</p>` : cards}
      ${addForm}
    </div>`;
}

function renderTripScreen(state, trip) {
  const days = trip.days;

  const dayCards = days.length
    ? days.map((day) => renderDayCard(state, day)).join("")
    : `<p class="empty-state">No days added yet.</p>`;

  const addDay = canEdit(state)
    ? `
      <div>
        <label for="new-day-date" style="font-size:13px; color:var(--muted-on-dark); display:block; margin-bottom:6px;">
          Add a day
        </label>
        <input type="date" id="new-day-date" class="date-input" data-action="add-day" />
      </div>`
    : "";

  return `
    <div class="trip-topbar">
      <button type="button" class="back-btn" data-action="back-to-trips">&larr; Trips</button>
      <h1 class="trip-title">${escapeHtml(trip.name)}</h1>
      <div class="trip-header-actions">
        ${
          canEdit(state)
            ? `<button type="button" class="icon-btn danger-hover" data-action="delete-trip" data-trip-id="${trip.id}" aria-label="Delete trip">🗑</button>`
            : ""
        }
        ${lockToggleHTML(state, true)}
      </div>
    </div>
    <div class="screen-pad">
      ${dayCards}
      ${addDay}
    </div>`;
}

function renderDayCard(state, day) {
  const isOpen = state.ui.openDayIds.has(day.id);
  const meals = day.meals;

  const mealCards = meals.map((m) => renderMealCard(state, day, m)).join("");

  const addingMeal = state.ui.addingMealDayIds.has(day.id);
  const addMealForm = canEdit(state)
    ? addingMeal
      ? `
        <div class="inline-form pad-top">
          <input type="text" id="new-meal-name-${day.id}" class="text-input dark" placeholder="e.g. Saturday Lunch" autocomplete="off" autofocus />
          <button type="button" class="btn-primary small" data-action="submit-add-meal" data-day-id="${day.id}">Add</button>
          <button type="button" class="icon-btn" data-action="cancel-add-meal" data-day-id="${day.id}" aria-label="Cancel">&times;</button>
        </div>`
      : `<button type="button" class="link-btn on-dark" data-action="open-add-meal" data-day-id="${day.id}">+ Add meal</button>`
    : "";

  return `
    <div class="day-card">
      <button type="button" class="day-card-header" data-action="toggle-day" data-day-id="${day.id}">
        <span class="day-card-header-left">
          <span aria-hidden="true">${isOpen ? "▾" : "▸"}</span>
          <span class="day-date mono">${formatDate(day.date)}</span>
        </span>
        <span class="day-card-header-right">
          <span class="meal-count">${meals.length} meal${meals.length !== 1 ? "s" : ""}</span>
          ${
            canEdit(state)
              ? `<span class="icon-btn danger-hover" role="button" tabindex="0" data-action="delete-day" data-day-id="${day.id}" aria-label="Delete day" style="padding:4px;">🗑</span>`
              : ""
          }
        </span>
      </button>
      ${isOpen ? `<div class="day-card-body">${mealCards}${addMealForm}</div>` : ""}
    </div>`;
}

function renderMealCard(state, day, meal) {
  const isOpen = state.ui.openMealIds.has(meal.id);
  const claimedCount = meal.ingredients.filter((i) => i.assignee && i.assignee.trim()).length;
  const total = meal.ingredients.length;
  const allClaimed = total > 0 && claimedCount === total;

  const rows = meal.ingredients.map((ing) => renderIngredientRow(state, day, meal, ing)).join("");

  const addingIng = state.ui.addingIngredientMealIds.has(meal.id);
  const addIngForm = canEdit(state)
    ? addingIng
      ? `
        <div class="inline-form pad-top">
          <input type="text" id="new-ing-name-${meal.id}" class="text-input light" placeholder="e.g. Buns, 8 pack" autocomplete="off" autofocus />
          <button type="button" class="btn-danger small" data-action="submit-add-ingredient" data-meal-id="${meal.id}" data-day-id="${day.id}">Add</button>
          <button type="button" class="icon-btn" style="color:var(--ink-muted);" data-action="cancel-add-ingredient" data-meal-id="${meal.id}" aria-label="Cancel">&times;</button>
        </div>`
      : `<button type="button" class="link-btn on-light" data-action="open-add-ingredient" data-meal-id="${meal.id}" data-day-id="${day.id}">+ Add ingredient</button>`
    : "";

  return `
    <div class="meal-card">
      <button type="button" class="meal-card-header" data-action="toggle-meal" data-meal-id="${meal.id}">
        <span class="meal-card-header-left">
          <span aria-hidden="true">${isOpen ? "▾" : "▸"}</span>
          <span aria-hidden="true">🍽</span>
          <span class="meal-name">${escapeHtml(meal.name)}</span>
        </span>
        <span class="meal-card-header-right">
          ${
            total > 0
              ? `<span class="claimed-badge ${allClaimed ? "all" : "partial"} mono">${claimedCount}/${total} CLAIMED</span>`
              : ""
          }
          ${
            canEdit(state)
              ? `<span class="icon-btn danger-hover" role="button" tabindex="0" style="padding:4px; color:#8A7F6C;" data-action="delete-meal" data-meal-id="${meal.id}" data-day-id="${day.id}" aria-label="Delete meal">🗑</span>`
              : ""
          }
        </span>
      </button>
      ${
        isOpen
          ? `<div class="meal-card-body">${rows}${addIngForm}</div>`
          : ""
      }
    </div>`;
}

function renderIngredientRow(state, day, meal, ing) {
  return `
    <div class="ingredient-row">
      <span class="ingredient-name">${escapeHtml(ing.name)}</span>
      <span style="display:flex; align-items:center; gap:4px;">
        <span aria-hidden="true" style="font-size:12px;">👤</span>
        <input
          type="text"
          class="assignee-input"
          autocomplete="off"
          value="${escapeHtml(ing.assignee || "")}"
          placeholder="who's bringing?"
          ${canEdit(state) ? "" : "disabled"}
          data-action="update-assignee"
          data-day-id="${day.id}"
          data-meal-id="${meal.id}"
          data-ing-id="${ing.id}"
        />
      </span>
      ${
        canEdit(state)
          ? `<span class="icon-btn danger-hover" role="button" tabindex="0" style="padding:2px; color:#8A7F6C;" data-action="delete-ingredient" data-day-id="${day.id}" data-meal-id="${meal.id}" data-ing-id="${ing.id}" aria-label="Remove ingredient">&times;</span>`
          : ""
      }
    </div>`;
}
