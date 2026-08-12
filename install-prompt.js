/**
 * install-prompt.js
 * Custom "install this app" banner, driven by Chrome's beforeinstallprompt
 * event. Android/Chrome only — iOS Safari has no equivalent API and simply
 * never fires this event, so this banner just never appears there. That's
 * expected, not a bug: iOS install is the manual "Share → Add to Home
 * Screen" flow, which no web API can trigger or detect.
 */

const INSTALL_DISMISSED_KEY = "cabinMealPlanner:installDismissed";
let deferredInstallPrompt = null;

function isRunningStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true // iOS's own (different) standalone flag
  );
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault(); // stop Chrome's automatic mini-infobar; we show our own banner instead
  if (isRunningStandalone() || localStorage.getItem(INSTALL_DISMISSED_KEY)) return;
  deferredInstallPrompt = event;
  document.getElementById("install-banner").hidden = false;
});

document.getElementById("install-btn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  document.getElementById("install-banner").hidden = true;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice; // resolves once the user accepts/dismisses Chrome's own dialog
  deferredInstallPrompt = null;
  localStorage.setItem(INSTALL_DISMISSED_KEY, "1"); // don't re-nag on future visits either way
});

document.getElementById("install-dismiss-btn").addEventListener("click", () => {
  document.getElementById("install-banner").hidden = true;
  localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
});

window.addEventListener("appinstalled", () => {
  document.getElementById("install-banner").hidden = true;
  localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
});
