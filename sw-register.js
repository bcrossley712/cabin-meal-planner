/**
 * sw-register.js
 * Registers the service worker and implements the "new version available"
 * banner: when an update is installed but waiting, show the banner; when
 * the user taps Refresh, tell the waiting worker to take over, then reload
 * once it actually has.
 */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").then((registration) => {
      // A worker may already be waiting if this tab was opened after an
      // update was installed in the background on a previous visit.
      if (registration.waiting) showUpdateBanner(registration);

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(registration);
          }
        });
      });
    });

    // Reload once the new worker has actually taken control, not before —
    // avoids reloading into a page still served by the old cache.
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

function showUpdateBanner(registration) {
  const banner = document.getElementById("update-banner");
  const btn = document.getElementById("update-refresh-btn");
  banner.hidden = false;
  btn.onclick = () => {
    if (registration.waiting) registration.waiting.postMessage("SKIP_WAITING");
  };
}
