(function () {
  "use strict";

  var COOKIE_NAME = "_imp_cmp";
  var COOKIE_DAYS = 7;

  var WORKSPACE_ID = null;
  var API_BASE = "";

  function findTrackerScript() {
    var script = document.currentScript;
    if (script && script.src && script.src.indexOf("tracker.js") !== -1) return script;
    var list = document.querySelectorAll('script[src*="tracker.js"]');
    return list.length ? list[list.length - 1] : null;
  }

  function initTrackerConfig() {
    var script = findTrackerScript();
    if (!script) return;
    WORKSPACE_ID =
      script.getAttribute("data-workspace") || script.getAttribute("data-workspace-id");
    var src = script.src || script.getAttribute("src") || "";
    if (!src) return;
    try {
      API_BASE = new URL(src, window.location.href).origin;
    } catch (e) {
      /* ignore */
    }
  }

  initTrackerConfig();

  function readWorkspaceId() {
    return WORKSPACE_ID;
  }

  function setCookie(name, value, days) {
    var maxAge = days * 24 * 60 * 60;
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax";
  }

  function getCookie(name) {
    var parts = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].trim().split("=");
      if (pair[0] === name) {
        return decodeURIComponent(pair.slice(1).join("="));
      }
    }
    return null;
  }

  function captureCampaignParam() {
    try {
      var params = new URLSearchParams(window.location.search);
      var cmp = params.get("cmp");
      if (cmp) setCookie(COOKIE_NAME, cmp, COOKIE_DAYS);
    } catch (e) {
      /* ignore */
    }
  }

  function apiBase() {
    return API_BASE;
  }

  function trackConversion(payload) {
    if (!readWorkspaceId() || !apiBase()) {
      initTrackerConfig();
    }
    var workspaceId = readWorkspaceId();
    if (!workspaceId) return Promise.resolve();

    var orderId = payload && payload.orderId;
    var value = payload && payload.value;
    var currency = (payload && payload.currency) || "BGN";

    if (!orderId || typeof value !== "number" || !(value > 0)) {
      return Promise.resolve();
    }

    var base = apiBase();
    if (!base) return Promise.resolve();

    return fetch(base + "/api/track/conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: workspaceId,
        orderId: String(orderId),
        value: value,
        currency: String(currency),
        campaignToken: getCookie(COOKIE_NAME),
      }),
      keepalive: true,
    }).catch(function () {
      /* silent */
    });
  }

  captureCampaignParam();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", captureCampaignParam);
  }

  window.impact28 = {
    trackConversion: trackConversion,
  };
})();
