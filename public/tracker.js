(function () {
  "use strict";

  var COOKIE_NAME = "_imp_cmp";
  var COOKIE_DAYS = 7;

  function currentScript() {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  }

  function readWorkspaceId() {
    var script = currentScript();
    if (!script) return null;
    return script.getAttribute("data-workspace") || script.getAttribute("data-workspace-id");
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
    var script = currentScript();
    var src = script && script.src ? script.src : "";
    if (!src) return "";
    try {
      var url = new URL(src);
      return url.origin;
    } catch (e) {
      return "";
    }
  }

  function trackConversion(payload) {
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
