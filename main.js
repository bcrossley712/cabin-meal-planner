/**
 * main.js
 * App state + event wiring + sync orchestration. Rendering lives in
 * render.js, network calls in api.js, on-device persistence in storage.js.
 *
 * Passcode model (important — see PROJECT_NOTES.md):
 * The app NEVER checks the passcode itself. Typing a passcode just stores
 * it on this device and optimistically shows the editing UI. The Worker is
 * the only thing that actually verifies it, on every write. If it's wrong,
 * the first save attempt fails (401), the app re-locks itself, clears the
 * bad passcode, and asks again. This is deliberate: the real passcode must
 * never be shipped in client-side code.
 */

function makeId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

const state = {
  data: { updatedAt: null, trips: [] },
  view: { screen: "list", tripId: null }, // "list" | "trip"
  unlocked: false,
  online: navigator.onLine,
  ui: {
    addingTrip: false,
    openDayIds: new Set(),
    openMealIds: new Set(),
    addingMealDayIds: new Set(),
    addingIngredientMealIds: new Set(),
  },
  confirmAction: null, // { title, message, onConfirm }
  syncStatus: "idle", // idle | syncing | pending | synced | offline | error
};

/* ---------------- Sync ---------------- */

let saveTimer = null;

function scheduleSave() {
  Storage.setCachedData(state.data); // persist locally immediately, before network round-trip
  setSyncStatus("pending");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 700);
}

async function flushSave() {
  setSyncStatus("syncing");
  try {
    const result = await Api.saveTrips(state.data.trips, state.data.updatedAt);
    state.data.updatedAt = result.updatedAt;
    Storage.setCachedData(state.data);
    setSyncStatus("synced");
  } catch (err) {
    if (err && err.status === 401) {
      Storage.clearPasscode();
      state.unlocked = false;
      renderApp(state);
      showToast("Incorrect passcode — that change wasn't saved.", true);
      openPasscodeModal();
    } else if (err && err.status === 409) {
      showToast("Someone else made changes — refreshing…", true);
      await refreshFromServer(true);
    } else {
      setSyncStatus("offline");
      showToast("Can't reach the server — will retry.", true);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 5000);
    }
  }
}

async function refreshFromServer(force) {
  // don't clobber an in-progress edit or unsaved change
  if (!force && (state.syncStatus === "pending" || state.syncStatus === "syncing")) return;
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;
  try {
    const result = await Api.getTrips();
    state.data = result;
    Storage.setCachedData(result);
    setSyncStatus("synced");
    renderApp(state);
  } catch (err) {
    setSyncStatus("offline");
  }
}

function setSyncStatus(status) {
  state.syncStatus = status;
  const toast = document.getElementById("sync-toast");
  if (status === "syncing" || status === "pending") {
    toast.textContent = "Saving…";
    toast.classList.remove("error");
    toast.hidden = false;
  } else if (status === "offline" || status === "error") {
    toast.textContent = "Offline — showing last saved version";
    toast.classList.add("error");
    toast.hidden = false;
  } else {
    toast.hidden = true;
  }
}

let toastTimer = null;
function showToast(message, isError) {
  const toast = document.getElementById("sync-toast");
  toast.textContent = message;
  toast.classList.toggle("error", !!isError);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (state.syncStatus !== "pending" && state.syncStatus !== "syncing") toast.hidden = true;
  }, 3000);
}

/* ---------------- Mutations ---------------- */

function mutateAndSave(fn) {
  // Belt-and-suspenders: the UI shouldn't offer edit controls while
  // offline at all (see render.js canEdit()), but guard here too in case
  // connectivity drops in the instant between tap and handler running.
  if (!state.online) {
    renderApp(state);
    return;
  }
  fn();
  scheduleSave();
  renderApp(state);
}

function addTrip(name) {
  mutateAndSave(() => {
    state.data.trips.push({ id: makeId(), name, days: [] });
  });
}

function deleteTrip(tripId) {
  mutateAndSave(() => {
    state.data.trips = state.data.trips.filter((t) => t.id !== tripId);
    if (state.view.tripId === tripId) state.view = { screen: "list", tripId: null };
  });
}

function addDay(tripId, isoDate) {
  const day = { id: makeId(), date: isoDate, meals: [] };
  mutateAndSave(() => {
    const trip = state.data.trips.find((t) => t.id === tripId);
    trip.days.push(day);
    trip.days.sort((a, b) => a.date.localeCompare(b.date));
  });
  state.ui.openDayIds.add(day.id);
  renderApp(state);
}

function deleteDay(tripId, dayId) {
  mutateAndSave(() => {
    const trip = state.data.trips.find((t) => t.id === tripId);
    trip.days = trip.days.filter((d) => d.id !== dayId);
  });
}

function addMeal(tripId, dayId, name) {
  mutateAndSave(() => {
    const trip = state.data.trips.find((t) => t.id === tripId);
    const day = trip.days.find((d) => d.id === dayId);
    day.meals.push({ id: makeId(), name, ingredients: [] });
  });
}

function deleteMeal(tripId, dayId, mealId) {
  mutateAndSave(() => {
    const trip = state.data.trips.find((t) => t.id === tripId);
    const day = trip.days.find((d) => d.id === dayId);
    day.meals = day.meals.filter((m) => m.id !== mealId);
  });
}

function addIngredient(tripId, dayId, mealId, name) {
  mutateAndSave(() => {
    const trip = state.data.trips.find((t) => t.id === tripId);
    const day = trip.days.find((d) => d.id === dayId);
    const meal = day.meals.find((m) => m.id === mealId);
    meal.ingredients.push({ id: makeId(), name, assignee: "" });
  });
}

function deleteIngredient(tripId, dayId, mealId, ingId) {
  mutateAndSave(() => {
    const trip = state.data.trips.find((t) => t.id === tripId);
    const day = trip.days.find((d) => d.id === dayId);
    const meal = day.meals.find((m) => m.id === mealId);
    meal.ingredients = meal.ingredients.filter((i) => i.id !== ingId);
  });
}

function updateAssignee(tripId, dayId, mealId, ingId, value) {
  if (!state.online) return; // input is disabled while offline; this is a backstop
  // No re-render here on purpose — the input already shows what the user
  // typed. Re-rendering mid-keystroke would steal focus.
  const trip = state.data.trips.find((t) => t.id === tripId);
  const day = trip.days.find((d) => d.id === dayId);
  const meal = day.meals.find((m) => m.id === mealId);
  const ing = meal.ingredients.find((i) => i.id === ingId);
  ing.assignee = value;
  scheduleSave();
}

/* ---------------- Confirm modal ---------------- */

function askConfirm(title, message, onConfirm) {
  state.confirmAction = { title, message, onConfirm };
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-message").textContent = message;
  document.getElementById("confirm-modal").hidden = false;
}
function closeConfirm() {
  state.confirmAction = null;
  document.getElementById("confirm-modal").hidden = true;
}

/* ---------------- Passcode modal ---------------- */

function openPasscodeModal() {
  document.getElementById("passcode-error").hidden = true;
  document.getElementById("passcode-input").value = "";
  document.getElementById("passcode-modal").hidden = false;
  document.getElementById("passcode-input").focus();
}
function closePasscodeModal() {
  document.getElementById("passcode-modal").hidden = true;
}
function submitPasscode() {
  const input = document.getElementById("passcode-input");
  const value = input.value;
  if (!value) return;
  Storage.setPasscode(value);
  input.value = ""; // don't leave the typed value sitting in the DOM after use
  state.unlocked = true;
  closePasscodeModal();
  renderApp(state);
  showToast("Editing unlocked on this device.");
}

/* ---------------- Event wiring ---------------- */

function currentTripId() {
  return state.view.tripId;
}

function handleAppClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    case "toggle-lock":
      if (!state.online) break; // button is disabled while offline; this is a backstop
      if (state.unlocked) {
        state.unlocked = false;
        renderApp(state);
      } else {
        openPasscodeModal();
      }
      break;

    case "select-trip":
      state.view = { screen: "trip", tripId: el.dataset.tripId };
      renderApp(state);
      break;

    case "back-to-trips":
      state.view = { screen: "list", tripId: null };
      renderApp(state);
      break;

    case "delete-trip": {
      const trip = state.data.trips.find((t) => t.id === el.dataset.tripId);
      askConfirm(
        "Delete trip?",
        `This removes "${trip.name}" and everything planned for it. This can't be undone.`,
        () => deleteTrip(trip.id)
      );
      break;
    }

    case "open-add-trip":
      state.ui.addingTrip = true;
      renderApp(state);
      document.getElementById("new-trip-name").focus();
      break;
    case "cancel-add-trip":
      state.ui.addingTrip = false;
      renderApp(state);
      break;
    case "submit-add-trip": {
      const input = document.getElementById("new-trip-name");
      const name = input.value.trim();
      state.ui.addingTrip = false;
      if (name) addTrip(name);
      else renderApp(state);
      break;
    }

    case "toggle-day": {
      const id = el.dataset.dayId;
      state.ui.openDayIds.has(id) ? state.ui.openDayIds.delete(id) : state.ui.openDayIds.add(id);
      renderApp(state);
      break;
    }

    case "delete-day": {
      const tripId = currentTripId();
      const trip = state.data.trips.find((t) => t.id === tripId);
      const day = trip.days.find((d) => d.id === el.dataset.dayId);
      askConfirm(
        "Delete this day?",
        `This removes ${formatDate(day.date)} and all its meals and ingredients.`,
        () => deleteDay(tripId, day.id)
      );
      break;
    }

    case "open-add-meal":
      state.ui.addingMealDayIds.add(el.dataset.dayId);
      renderApp(state);
      document.getElementById(`new-meal-name-${el.dataset.dayId}`).focus();
      break;
    case "cancel-add-meal":
      state.ui.addingMealDayIds.delete(el.dataset.dayId);
      renderApp(state);
      break;
    case "submit-add-meal": {
      const dayId = el.dataset.dayId;
      const input = document.getElementById(`new-meal-name-${dayId}`);
      const name = input.value.trim();
      state.ui.addingMealDayIds.delete(dayId);
      if (name) addMeal(currentTripId(), dayId, name);
      else renderApp(state);
      break;
    }

    case "toggle-meal": {
      const id = el.dataset.mealId;
      state.ui.openMealIds.has(id) ? state.ui.openMealIds.delete(id) : state.ui.openMealIds.add(id);
      renderApp(state);
      break;
    }

    case "delete-meal": {
      const tripId = currentTripId();
      const dayId = el.dataset.dayId;
      const trip = state.data.trips.find((t) => t.id === tripId);
      const day = trip.days.find((d) => d.id === dayId);
      const meal = day.meals.find((m) => m.id === el.dataset.mealId);
      askConfirm("Delete this meal?", `This removes "${meal.name}" and its ingredient list.`, () =>
        deleteMeal(tripId, dayId, meal.id)
      );
      break;
    }

    case "open-add-ingredient":
      state.ui.addingIngredientMealIds.add(el.dataset.mealId);
      renderApp(state);
      document.getElementById(`new-ing-name-${el.dataset.mealId}`).focus();
      break;
    case "cancel-add-ingredient":
      state.ui.addingIngredientMealIds.delete(el.dataset.mealId);
      renderApp(state);
      break;
    case "submit-add-ingredient": {
      const mealId = el.dataset.mealId;
      const dayId = el.dataset.dayId;
      const input = document.getElementById(`new-ing-name-${mealId}`);
      const name = input.value.trim();
      state.ui.addingIngredientMealIds.delete(mealId);
      if (name) addIngredient(currentTripId(), dayId, mealId, name);
      else renderApp(state);
      break;
    }

    case "delete-ingredient": {
      const tripId = currentTripId();
      const dayId = el.dataset.dayId;
      const mealId = el.dataset.mealId;
      const trip = state.data.trips.find((t) => t.id === tripId);
      const day = trip.days.find((d) => d.id === dayId);
      const meal = day.meals.find((m) => m.id === mealId);
      const ing = meal.ingredients.find((i) => i.id === el.dataset.ingId);
      askConfirm("Remove this ingredient?", `"${ing.name}" will be removed from the list.`, () =>
        deleteIngredient(tripId, dayId, mealId, ing.id)
      );
      break;
    }

    case "close-passcode":
      closePasscodeModal();
      break;
    case "submit-passcode":
      submitPasscode();
      break;

    case "cancel-confirm":
      closeConfirm();
      break;
    case "do-confirm":
      if (state.confirmAction) state.confirmAction.onConfirm();
      closeConfirm();
      break;
  }
}

function handleAppInput(e) {
  if (e.target.dataset.action === "update-assignee") {
    const { dayId, mealId, ingId } = e.target.dataset;
    updateAssignee(currentTripId(), dayId, mealId, ingId, e.target.value);
  } else if (e.target.dataset.action === "add-day") {
    if (e.target.value) addDay(currentTripId(), e.target.value);
    e.target.value = "";
  }
}

function handleAppKeydown(e) {
  if (e.key !== "Enter") return;
  const map = {
    "new-trip-name": "submit-add-trip",
    "passcode-input": "submit-passcode",
  };
  if (map[e.target.id]) {
    e.preventDefault();
    document.querySelector(`[data-action="${map[e.target.id]}"]`)?.click();
    return;
  }
  if (e.target.id && e.target.id.startsWith("new-meal-name-")) {
    e.preventDefault();
    const dayId = e.target.id.replace("new-meal-name-", "");
    document.querySelector(`[data-action="submit-add-meal"][data-day-id="${dayId}"]`)?.click();
  }
  if (e.target.id && e.target.id.startsWith("new-ing-name-")) {
    e.preventDefault();
    const mealId = e.target.id.replace("new-ing-name-", "");
    document.querySelector(`[data-action="submit-add-ingredient"][data-meal-id="${mealId}"]`)?.click();
  }
}

/* ---------------- Offline handling ---------------- */

function updateOnlineStatus() {
  state.online = navigator.onLine;
  document.getElementById("offline-banner").hidden = state.online;
  // Any add/edit/delete controls need to appear/disappear immediately —
  // canEdit() in render.js checks state.online, so a re-render is enough.
  renderApp(state);
  if (state.online) refreshFromServer(true); // catch up on anything missed
}

/* ---------------- Init ---------------- */

async function init() {
  // Click delegation is on document.body, not #app: the passcode and
  // confirm modals live outside #app on purpose (renderApp() replaces
  // #app's entire innerHTML on every render, which would wipe out a modal
  // mid-use if it lived inside). #app alone would miss clicks on those
  // modals entirely — this bit us once already, don't re-narrow it.
  document.body.addEventListener("click", handleAppClick);
  document.getElementById("app").addEventListener("input", handleAppInput);
  document.getElementById("app").addEventListener("keydown", handleAppKeydown);
  document.getElementById("passcode-input").addEventListener("keydown", handleAppKeydown);

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  // Device already knows the passcode from a previous visit — unlock
  // optimistically. The next save/verify will confirm it's still correct.
  if (Storage.getPasscode()) state.unlocked = true;

  // Show cached data immediately so the app isn't blank while we fetch.
  const cached = Storage.getCachedData();
  if (cached) state.data = cached;
  document.getElementById("offline-banner").hidden = state.online;
  renderApp(state);

  await refreshFromServer(true);

  // Poll for updates from other devices while the app is open.
  setInterval(() => {
    if (state.online) refreshFromServer(false);
  }, 20000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.online) refreshFromServer(false);
  });
}

init();
