(function () {
  "use strict";

  var endpointBase = "";
  var includeReferrer = true;
  var debug = false;
  var heartbeatIntervalMillis = 5000;
  var writeToken = "";

  if (typeof window.TINYANALYTICS_ENDPOINT === "string" && window.TINYANALYTICS_ENDPOINT.length > 0) {
    endpointBase = window.TINYANALYTICS_ENDPOINT;
  }

  if (typeof window.TINYANALYTICS_DEBUG === "boolean") {
    debug = window.TINYANALYTICS_DEBUG;
  }
  if (typeof window.TINYANALYTICS_WRITE_TOKEN === "string" && window.TINYANALYTICS_WRITE_TOKEN.length > 0) {
    writeToken = window.TINYANALYTICS_WRITE_TOKEN;
  }

  var scriptElement = document.currentScript;
  if (!scriptElement) {
    scriptElement = document.querySelector('script[src*="tinyanalytics-v0.autotrack.js"]');
  }

  if (scriptElement) {
    endpointBase = scriptElement.getAttribute("data-endpoint") || endpointBase;
    if (scriptElement.getAttribute("data-include-referrer") === "false") {
      includeReferrer = false;
    }
    if (scriptElement.getAttribute("data-debug") === "true") {
      debug = true;
    }
    writeToken = scriptElement.getAttribute("data-write-token") || writeToken;
  }

  if (!endpointBase) {
    endpointBase = window.location.origin;
  }

  endpointBase = normalizeBaseEndpoint(endpointBase);

  var sessionId = 0n;
  var sessionExpiresAtMillis = 0;
  var lastTrackedPath = "";
  var textEncoder = new TextEncoder();
  var keepaliveTimer = null;
  var EVENT_TYPE_PAGE_VIEW = 1;
  var EVENT_TYPE_KEEPALIVE = 2;

  function logInfo() {
    if (debug) {
      console.info.apply(console, arguments);
    }
  }

  function logWarn() {
    if (debug) {
      console.warn.apply(console, arguments);
    }
  }

  function normalizeBaseEndpoint(value) {
    var trimmed = value;
    if (trimmed.endsWith("/v0/events/page_view")) {
      return trimmed.slice(0, -"/v0/events/page_view".length);
    }
    if (trimmed.charAt(trimmed.length - 1) === "/") {
      return trimmed.slice(0, -1);
    }
    return trimmed;
  }

  function eventEndpointPath() {
    return withWriteToken(endpointBase + "/v0/events");
  }

  function sessionEndpointPath() {
    return withWriteToken(endpointBase + "/v0/sessions");
  }

  function withWriteToken(url) {
    if (!writeToken) {
      return url;
    }
    var separator = url.indexOf("?") === -1 ? "?" : "&";
    return url + separator + "access_token=" + encodeURIComponent(writeToken);
  }

  function nowMillis() {
    return Date.now();
  }

  function currentPath() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  function encodeUtf8WithLimit(value, maxBytes, fieldName) {
    var encoded = textEncoder.encode(value);
    if (fieldName === "path" && encoded.length === 0) {
      throw new Error("path cannot be empty");
    }
    if (encoded.length > maxBytes) {
      throw new Error(fieldName + " exceeds max length");
    }
    return encoded;
  }

  function encodePageViewPayload(eventTimeMillis, sessionIdValue, path, referrer) {
    var pathBytes = encodeUtf8WithLimit(path, 2048, "path");
    var referrerBytes = encodeUtf8WithLimit(referrer, 4096, "referrer");

    var payloadSize = 8 + 8 + 2 + pathBytes.length + 2 + referrerBytes.length;
    var payload = new Uint8Array(payloadSize);
    var dataView = new DataView(payload.buffer);
    var offset = 0;

    dataView.setBigInt64(offset, BigInt(eventTimeMillis), true);
    offset += 8;

    dataView.setBigUint64(offset, sessionIdValue, true);
    offset += 8;

    dataView.setUint16(offset, pathBytes.length, true);
    offset += 2;
    payload.set(pathBytes, offset);
    offset += pathBytes.length;

    dataView.setUint16(offset, referrerBytes.length, true);
    offset += 2;
    payload.set(referrerBytes, offset);

    return wrapEventPayload(EVENT_TYPE_PAGE_VIEW, payload);
  }

  function encodeKeepalivePayload(eventTimeMillis, sessionIdValue) {
    var payload = new Uint8Array(16);
    var dataView = new DataView(payload.buffer);
    dataView.setBigInt64(0, BigInt(eventTimeMillis), true);
    dataView.setBigUint64(8, sessionIdValue, true);
    return wrapEventPayload(EVENT_TYPE_KEEPALIVE, payload);
  }

  function wrapEventPayload(eventType, payload) {
    var wrapped = new Uint8Array(1 + payload.length);
    wrapped[0] = eventType;
    wrapped.set(payload, 1);
    return wrapped;
  }

  function sendBinary(url, payload, useBeacon) {
    if (useBeacon && navigator.sendBeacon) {
      try {
        var blob = new Blob([payload], { type: "application/octet-stream" });
        var accepted = navigator.sendBeacon(url, blob);
        if (accepted) {
          return Promise.resolve({ ok: true, status: 202 });
        }
      } catch (error) {
        logWarn("[tinyanalytics] beacon failed, fallback to fetch", error);
      }
    }

    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: payload,
      keepalive: true,
      credentials: "omit",
      cache: "no-store",
    });
  }

  function persistSession() {
    try {
      sessionStorage.setItem("tinyanalytics.session_id", sessionId.toString());
      sessionStorage.setItem("tinyanalytics.session_expires_at", String(sessionExpiresAtMillis));
    } catch (error) {
      logWarn("[tinyanalytics] persist session failed", error);
    }
  }

  function clearPersistedSession() {
    sessionId = 0n;
    sessionExpiresAtMillis = 0;
    try {
      sessionStorage.removeItem("tinyanalytics.session_id");
      sessionStorage.removeItem("tinyanalytics.session_expires_at");
    } catch (_) {
      // Ignore storage errors.
    }
  }

  function restoreSessionFromStorage() {
    try {
      var storedSessionId = sessionStorage.getItem("tinyanalytics.session_id");
      var storedExpiresAt = sessionStorage.getItem("tinyanalytics.session_expires_at");
      if (!storedSessionId || !storedExpiresAt) {
        return false;
      }

      var expiresAt = Number(storedExpiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= nowMillis()) {
        clearPersistedSession();
        return false;
      }

      sessionId = BigInt(storedSessionId);
      sessionExpiresAtMillis = expiresAt;
      logInfo("[tinyanalytics] restored session", storedSessionId);
      return sessionId !== 0n;
    } catch (error) {
      logWarn("[tinyanalytics] restore session failed", error);
      return false;
    }
  }

  async function createSession() {
    var response = await fetch(sessionEndpointPath(), {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("session create failed: " + response.status);
    }
    var body = await response.json();
    if (!body || typeof body.session_id !== "number") {
      throw new Error("session create response missing session_id");
    }
    sessionId = BigInt(body.session_id);
    sessionExpiresAtMillis = Number(body.expires_at_millis || 0);
    persistSession();
    logInfo("[tinyanalytics] session created", body.session_id);
  }

  async function sendKeepalive() {
    if (sessionId === 0n) {
      return;
    }
    logInfo("[tinyanalytics] keepalive send", sessionId.toString());
    var response = await sendKeepaliveOnce();
    if (!response.ok && response.status === 410) {
      logWarn("[tinyanalytics] keepalive got 410, recreating session");
      clearPersistedSession();
      await createSession();
      response = await sendKeepaliveOnce();
    }
    if (!response.ok) {
      throw new Error("keepalive failed: " + response.status);
    }
    logInfo("[tinyanalytics] keepalive ok", response.status);

    try {
      var body = await response.json();
      if (body && typeof body.expires_at_millis === "number") {
        sessionExpiresAtMillis = body.expires_at_millis;
        persistSession();
      }
    } catch (_) {
      // Ignore response body parsing errors.
    }
  }

  function sendKeepaliveOnce() {
    if (sessionId === 0n) {
      return Promise.resolve({ ok: false, status: 410 });
    }
    var payload = encodeKeepalivePayload(nowMillis(), sessionId);
    return sendBinary(eventEndpointPath(), payload, false);
  }

  function scheduleKeepalive() {
    if (keepaliveTimer !== null) {
      clearInterval(keepaliveTimer);
    }
    void sendKeepalive().catch(function (error) {
      logWarn("[tinyanalytics] initial keepalive error", error);
    });
    keepaliveTimer = setInterval(function () {
      sendKeepalive().catch(function (error) {
        logWarn("[tinyanalytics] keepalive error", error);
      });
    }, heartbeatIntervalMillis);
  }

  function trackPageView() {
    if (sessionId === 0n) {
      return;
    }

    var path = currentPath();
    if (path === lastTrackedPath) {
      return;
    }
    lastTrackedPath = path;

    var referrer = includeReferrer ? document.referrer : "";

    try {
      sendPageViewWithRetry(path, referrer)
        .then(function (response) {
          if (!response.ok) {
            logWarn("[tinyanalytics] page view failed", response.status);
          }
        })
        .catch(function (error) {
          logWarn("[tinyanalytics] page view send error", error);
        });
      logInfo("[tinyanalytics] track", path);
    } catch (error) {
      logWarn("[tinyanalytics] dropped event", error);
    }
  }

  async function sendPageViewWithRetry(path, referrer) {
    var response = await sendPageViewOnce(path, referrer);
    if (!response.ok && response.status === 410) {
      logWarn("[tinyanalytics] page view got 410, recreating session");
      clearPersistedSession();
      await createSession();
      response = await sendPageViewOnce(path, referrer);
    }
    return response;
  }

  function sendPageViewOnce(path, referrer) {
    if (sessionId === 0n) {
      return Promise.resolve({ ok: false, status: 410 });
    }
    var payload = encodePageViewPayload(nowMillis(), sessionId, path, referrer);
    return sendBinary(eventEndpointPath(), payload, true);
  }

  function patchHistoryMethod(methodName) {
    var original = history[methodName];
    if (typeof original !== "function") {
      return;
    }
    history[methodName] = function () {
      var result = original.apply(this, arguments);
      trackPageView();
      return result;
    };
  }

  async function init() {
    logInfo("[tinyanalytics] init", { endpointBase: endpointBase, includeReferrer: includeReferrer });
    try {
      var restored = restoreSessionFromStorage();
      if (!restored) {
        await createSession();
      }
      trackPageView();
      scheduleKeepalive();
      window.addEventListener("popstate", trackPageView);
      window.addEventListener("hashchange", trackPageView);
      patchHistoryMethod("pushState");
      patchHistoryMethod("replaceState");
    } catch (error) {
      logWarn("[tinyanalytics] init failed", error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        void init();
      },
      { once: true }
    );
  } else {
    void init();
  }
})();