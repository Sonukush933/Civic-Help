/* Public runtime settings only. Configure the production backend URL in index.html. */
(function (w) {
  "use strict";
  var host = w.location.hostname;
  var isLocal = host === "localhost" || host === "127.0.0.1";
  var overrides = w.CH_CONFIG || {};
  var apiMeta = document.querySelector('meta[name="civichelp-api-base"]');
  var productionBase = apiMeta ? apiMeta.content.trim().replace(/\/+$/, "") : "";
  var apiBase = isLocal ? "http://localhost:4000" : productionBase;

  if (!isLocal && apiBase) {
    try {
      if (new URL(apiBase).protocol !== "https:") throw new Error("HTTPS is required");
    } catch (error) {
      console.error("CivicHelp production API URL must be a valid HTTPS URL.", error);
      apiBase = "";
    }
  }

  w.CH_CONFIG = Object.freeze(Object.assign(
    { API_MODE: "live", API_BASE: apiBase, TIMEOUT_MS: 8000, RETRIES: 2, MOCK_DELAY_MS: 0 },
    isLocal ? overrides : { API_MODE: "live", API_BASE: apiBase },
  ));
})(window);
