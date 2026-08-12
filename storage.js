/**
 * storage.js
 * Thin wrapper around localStorage for the two things this app persists
 * on-device: the remembered family passcode, and a local cache of the
 * last-known trip data (so the app has something to show immediately on
 * load, and something to fall back to if the network/API is unreachable).
 *
 * Note: the passcode is stored in plain localStorage. That's a deliberate
 * trade-off for this app's threat model (a known family, not the public) —
 * see PROJECT_NOTES.md. It is never trusted on its own for writes; the
 * Worker re-checks it server-side on every write request.
 */

const PASSCODE_KEY = "cabinMealPlanner:passcode";
const CACHE_KEY = "cabinMealPlanner:cachedData";

const Storage = {
  getPasscode() {
    return localStorage.getItem(PASSCODE_KEY) || "";
  },
  setPasscode(value) {
    localStorage.setItem(PASSCODE_KEY, value);
  },
  clearPasscode() {
    localStorage.removeItem(PASSCODE_KEY);
  },

  getCachedData() {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Cached data was corrupt, ignoring it.", e);
      return null;
    }
  },
  setCachedData(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not cache data locally (storage full?).", e);
    }
  },
};
