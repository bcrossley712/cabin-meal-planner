/**
 * api.js
 * All communication with the Cloudflare Worker backend lives here.
 *
 * >>> EDIT THIS after you deploy the Worker (see /cf-worker/README.md): <<<
 */
const API_BASE_URL = "https://cabin-meal-planner.bcrossley712.workers.dev";

/**
 * Data shape returned by the Worker and cached locally:
 * { updatedAt: "<ISO timestamp>" | null, trips: [ ...trip objects... ] }
 */

const Api = {
  /**
   * Fetch the current shared data. Throws on network failure so callers
   * can decide how to fall back (e.g. to the local cache).
   */
  async getTrips() {
    const res = await fetch(`${API_BASE_URL}/api/trips`, { method: "GET" });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    return res.json();
  },

  /**
   * Save the full trips list. Requires the family passcode (server-side
   * checked, this is not just a client-side gate) and the last-known
   * updatedAt value, so the Worker can detect if someone else saved
   * changes in between (basic optimistic-concurrency check).
   *
   * Return value on success: the new { updatedAt, trips } from the server.
   * Throws an Error with `.status` set on failure — callers should check
   * `.status === 401` (wrong passcode) and `.status === 409` (someone
   * else's edit landed first — caller should refetch and retry).
   */
  async saveTrips(trips, expectedUpdatedAt) {
    const res = await fetch(`${API_BASE_URL}/api/trips`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Passcode": Storage.getPasscode(),
      },
      body: JSON.stringify({ trips, expectedUpdatedAt }),
    });

    if (!res.ok) {
      const err = new Error(`Server returned ${res.status}`);
      err.status = res.status;
      try {
        err.body = await res.json();
      } catch (e) {
        /* no JSON body, ignore */
      }
      throw err;
    }
    return res.json();
  },
};
