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

// Emoji (🗑, etc.) render as a different picture per-OS emoji font and
// ignore CSS `color` entirely — inline SVG instead renders identically on
// iOS/Android and correctly inherits button color/hover states via
// currentColor.
function trashIconSVG(size) {
  const s = size || 16;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>`;
}

function lockIconSVG(open, size) {
  const s = size || 16;
  const shackle = open
    ? '<path d="M7 10V7a5 5 0 0 1 9.3-2.5"></path>'
    : '<path d="M7 10V7a5 5 0 0 1 10 0v3"></path>';
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;"><rect x="4" y="10" width="16" height="10" rx="2"></rect>${shackle}</svg>`;
}

function userIconSVG(size) {
  const s = size || 14;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-7 8-7s8 3 8 7"></path></svg>`;
}

function utensilsIconSVG(size) {
  const s = size || 15;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;"><path d="M7 2v6a2 2 0 0 1-4 0V2"></path><path d="M5 8v14"></path><path d="M17 2c-1.7 0-3 2-3 5s1.3 5 3 5"></path><path d="M17 2v20"></path></svg>`;
}

function tentIconSVG(size) {
  const s = size || 18;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;"><path d="M2 21L12 3l10 18"></path><path d="M9.5 21L12 15l2.5 6"></path><path d="M2 21h20"></path></svg>`;
}

function checkIconSVG(size) {
  const s = size || 16;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M20 6L9 17l-5-5"></path></svg>`;
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
      <span aria-hidden="true" style="display:flex;">${lockIconSVG(showUnlocked, 15)}</span>
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
          <span class="trip-icon-badge" aria-hidden="true">${tentIconSVG(18)}</span>
          <span style="flex:1; min-width:0;">
            <span class="trip-card-name" style="display:block;">${escapeHtml(t.name)}</span>
            <span class="trip-card-sub">${dayCount} day${dayCount !== 1 ? "s" : ""} planned</span>
          </span>
        </button>
        ${
          canEdit(state)
            ? `<button type="button" class="icon-btn danger-hover" data-action="delete-trip" data-trip-id="${t.id}" aria-label="Delete trip">${trashIconSVG(18)}</button>`
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
    : canEdit(state)
    ? `<button type="button" class="dashed-btn" data-action="open-add-trip">+ New trip</button>`
    : "";

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
            ? `<button type="button" class="icon-btn danger-hover" data-action="delete-trip" data-trip-id="${trip.id}" aria-label="Delete trip">${trashIconSVG(18)}</button>`
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
              ? `<span class="icon-btn danger-hover" role="button" tabindex="0" data-action="delete-day" data-day-id="${day.id}" aria-label="Delete day" style="padding:4px;">${trashIconSVG(16)}</span>`
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
          <span aria-hidden="true" style="display:flex;">${utensilsIconSVG(14)}</span>
          <span class="meal-name">${escapeHtml(meal.name)}</span>
        </span>
        <span class="meal-card-header-right">
          ${
            total > 0 && allClaimed
              ? `<span role="img" aria-label="All ingredients claimed" style="display:flex; color:var(--sage);">${checkIconSVG(16)}</span>`
              : ""
          }
          ${
            canEdit(state)
              ? `<span class="icon-btn danger-hover" role="button" tabindex="0" style="padding:4px; color:#8A7F6C;" data-action="delete-meal" data-meal-id="${meal.id}" data-day-id="${day.id}" aria-label="Delete meal">${trashIconSVG(16)}</span>`
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
      <span class="ingredient-row-bottom">
        <span style="display:flex; align-items:center; gap:4px; flex:1; min-width:0;">
          <span aria-hidden="true" style="display:flex; flex-shrink:0;">${userIconSVG(12)}</span>
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
      </span>
    </div>`;
}
