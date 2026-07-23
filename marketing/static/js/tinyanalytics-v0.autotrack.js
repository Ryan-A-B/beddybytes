(function () {
  "use strict";

  var endpointBase = "";
  var includeReferrer = true;
  var debug = false;
  var heartbeatIntervalMillis = 20000;
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

  var CLIENT_ID_STORAGE_KEY = "tinyanalytics.client_id";
  var MAX_EVENT_BODY_BYTES = 1024;
  var EVENT_TYPE_SESSION_CREATED = 1;
  var EVENT_TYPE_SESSION_ENDED = 2;
  var EVENT_TYPE_PAGE_VIEW = 3;
  var END_REASON_VISIBILITY_CHANGE = 2;
  var END_REASON_PAGE_HIDE = 3;

  var clientIdBytes = null;
  var sessionId = "";
  var createSessionPromise = null;
  var pendingCloseReason = 0;
  var lastTrackedPath = "";
  var textEncoder = new TextEncoder();
  var keepaliveTimer = null;

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
    return value.charAt(value.length - 1) === "/" ? value.slice(0, -1) : value;
  }

  function withWriteToken(url) {
    if (!writeToken) {
      return url;
    }
    var separator = url.indexOf("?") === -1 ? "?" : "&";
    return url + separator + "access_token=" + encodeURIComponent(writeToken);
  }

  function sessionEndpointPath() {
    return withWriteToken(endpointBase + "/sessions");
  }

  function eventEndpointPath(sessionIdValue) {
    return withWriteToken(endpointBase + "/sessions/" + sessionIdValue + "/events");
  }

  function pingEndpointPath(sessionIdValue) {
    return withWriteToken(endpointBase + "/sessions/" + sessionIdValue + "/ping");
  }

  function randomIdBytes() {
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  function bytesToHex(bytes) {
    var value = "";
    for (var index = 0; index < bytes.length; index += 1) {
      value += bytes[index].toString(16).padStart(2, "0");
    }
    return value;
  }

  function hexToIdBytes(value) {
    if (!/^[0-9a-fA-F]{32}$/.test(value) || /^0{32}$/.test(value)) {
      return null;
    }
    var bytes = new Uint8Array(16);
    for (var index = 0; index < bytes.length; index += 1) {
      bytes[index] = parseInt(value.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }

  function loadOrCreateClientId() {
    try {
      var stored = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
      var parsed = stored ? hexToIdBytes(stored) : null;
      if (parsed) {
        return parsed;
      }
      var created = randomIdBytes();
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, bytesToHex(created));
      return created;
    } catch (error) {
      logWarn("[tinyanalytics] local client id unavailable; using an ephemeral id", error);
      return randomIdBytes();
    }
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

  function encodePageViewPayload(eventTimeMillis, path) {
    var pathBytes = encodeUtf8WithLimit(path, 2048, "path");
    var payload = concatenateBytes([
      encodeLong(BigInt(eventTimeMillis)),
      encodeLong(BigInt(EVENT_TYPE_PAGE_VIEW)),
      encodeLong(BigInt(pathBytes.length)),
      pathBytes,
    ]);
    enforceBodyLimit(payload);
    return payload;
  }

  function encodeSessionCreatedPayload(eventTimeMillis, clientBytes, sessionBytes, path, referrer, userAgent, language, timezone, deviceWidth, deviceHeight) {
    var pathBytes = encodeUtf8WithLimit(path, 2048, "path");
    var referrerBytes = encodeUtf8WithLimit(referrer, 4096, "referrer");
    var userAgentBytes = encodeUtf8WithLimit(userAgent, 256, "user_agent");
    var languageBytes = encodeUtf8WithLimit(language, 64, "language");
    var timezoneBytes = encodeUtf8WithLimit(timezone, 64, "timezone");
    var payload = concatenateBytes([
      encodeLong(BigInt(eventTimeMillis)),
      encodeLong(BigInt(EVENT_TYPE_SESSION_CREATED)),
      clientBytes,
      sessionBytes,
      encodeLong(BigInt(pathBytes.length)),
      pathBytes,
      encodeLong(BigInt(referrerBytes.length)),
      referrerBytes,
      encodeLong(BigInt(userAgentBytes.length)),
      userAgentBytes,
      encodeLong(BigInt(languageBytes.length)),
      languageBytes,
      encodeLong(BigInt(timezoneBytes.length)),
      timezoneBytes,
      encodeLong(BigInt(deviceWidth)),
      encodeLong(BigInt(deviceHeight)),
    ]);
    enforceBodyLimit(payload);
    return payload;
  }

  function encodeSessionEndedPayload(eventTimeMillis, reason) {
    var payload = concatenateBytes([
      encodeLong(BigInt(eventTimeMillis)),
      encodeLong(BigInt(EVENT_TYPE_SESSION_ENDED)),
      encodeLong(BigInt(reason)),
    ]);
    enforceBodyLimit(payload);
    return payload;
  }

  function enforceBodyLimit(payload) {
    if (payload.length > MAX_EVENT_BODY_BYTES) {
      throw new Error("event payload exceeds 1024 bytes");
    }
  }

  function encodeLong(value) {
    var encoded = BigInt.asUintN(64, (value << 1n) ^ (value >> 63n));
    var bytes = [];
    while ((encoded & ~0x7fn) !== 0n) {
      bytes.push(Number((encoded & 0x7fn) | 0x80n));
      encoded >>= 7n;
    }
    bytes.push(Number(encoded));
    return new Uint8Array(bytes);
  }

  function concatenateBytes(parts) {
    var totalLength = parts.reduce(function (total, part) {
      return total + part.length;
    }, 0);
    var combined = new Uint8Array(totalLength);
    var offset = 0;
    parts.forEach(function (part) {
      combined.set(part, offset);
      offset += part.length;
    });
    return combined;
  }

  function optionalNavigatorString(value) {
    return typeof value === "string" ? value : "";
  }

  function currentTimezone() {
    try {
      var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return optionalNavigatorString(timezone);
    } catch (error) {
      logWarn("[tinyanalytics] browser timezone unavailable", error);
      return "";
    }
  }

  function currentDeviceDimension(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return 0;
    }
    var dimension = Math.round(value);
    return dimension >= 0 && dimension <= 65535 ? dimension : 0;
  }

  function postBinary(url, payload) {
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: payload,
      keepalive: true,
      credentials: "omit",
      cache: "no-store",
    });
  }

  function sendBeaconOrFetch(url, payload) {
    if (navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(url, payload)) {
          return;
        }
      } catch (error) {
        logWarn("[tinyanalytics] beacon failed, falling back to fetch", error);
      }
    }
    void postBinary(url, payload).catch(function (error) {
      logWarn("[tinyanalytics] lifecycle request failed", error);
    });
  }

  async function createSession() {
    if (sessionId) {
      return;
    }
    if (createSessionPromise) {
      return createSessionPromise;
    }

    createSessionPromise = (async function () {
      var newSessionBytes = randomIdBytes();
      var newSessionId = bytesToHex(newSessionBytes);
      var path = currentPath();
      var referrer = includeReferrer ? document.referrer : "";
      var userAgent = optionalNavigatorString(navigator.userAgent);
      var language = optionalNavigatorString(navigator.language);
      var timezone = currentTimezone();
      var deviceWidth = currentDeviceDimension(window.screen && window.screen.width);
      var deviceHeight = currentDeviceDimension(window.screen && window.screen.height);
      var response = await postBinary(
        sessionEndpointPath(),
        encodeSessionCreatedPayload(Date.now(), clientIdBytes, newSessionBytes, path, referrer, userAgent, language, timezone, deviceWidth, deviceHeight)
      );
      if (!response.ok) {
        throw new Error("session create failed: " + response.status);
      }
      sessionId = newSessionId;
      lastTrackedPath = path;
      logInfo("[tinyanalytics] session created", sessionId);

      if (pendingCloseReason !== 0 || document.visibilityState !== "visible") {
        var closeReason = pendingCloseReason || END_REASON_VISIBILITY_CHANGE;
        pendingCloseReason = 0;
        closeSession(closeReason);
      }
      return response;
    })();

    try {
      return await createSessionPromise;
    } finally {
      createSessionPromise = null;
    }
  }

  function stopKeepalive() {
    if (keepaliveTimer !== null) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  }

  function sendKeepalive() {
    if (!sessionId) {
      return;
    }
    sendBeaconOrFetch(pingEndpointPath(sessionId), new Uint8Array(0));
  }

  function scheduleKeepalive() {
    stopKeepalive();
    if (!sessionId || document.visibilityState !== "visible") {
      return;
    }
    keepaliveTimer = setInterval(sendKeepalive, heartbeatIntervalMillis);
  }

  function closeSession(reason) {
    stopKeepalive();
    if (!sessionId) {
      if (createSessionPromise) {
        pendingCloseReason = pendingCloseReason || reason;
      }
      return;
    }
    var closingSessionId = sessionId;
    sessionId = "";
    lastTrackedPath = "";
    sendBeaconOrFetch(
      eventEndpointPath(closingSessionId),
      encodeSessionEndedPayload(Date.now(), reason)
    );
    logInfo("[tinyanalytics] session closed", closingSessionId, reason);
  }

  async function sendPageViewWithRetry(payload, originalSessionId) {
    var response = await postBinary(eventEndpointPath(originalSessionId), payload);
    if (response.status !== 404 || document.visibilityState !== "visible") {
      return response;
    }
    if (sessionId === originalSessionId) {
      sessionId = "";
      stopKeepalive();
    }
    var createResponse = await createSession();
    if (!sessionId) {
      return response;
    }
    scheduleKeepalive();
    return createResponse || response;
  }

  function trackPageView() {
    if (!sessionId) {
      return;
    }
    var path = currentPath();
    if (path === lastTrackedPath) {
      return;
    }
    lastTrackedPath = path;
    try {
      var payload = encodePageViewPayload(Date.now(), path);
      var activeSessionId = sessionId;
      void sendPageViewWithRetry(payload, activeSessionId)
        .then(function (response) {
          if (!response.ok) {
            if (response.status === 503) {
              logWarn("[tinyanalytics] server temporarily lacks ingress capacity");
            } else {
              logWarn("[tinyanalytics] page view failed", response.status);
            }
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

  async function startVisibleSession() {
    if (document.visibilityState !== "visible") {
      return;
    }
    try {
      await createSession();
      if (!sessionId && document.visibilityState === "visible") {
        await createSession();
      }
      if (sessionId) {
        scheduleKeepalive();
      }
    } catch (error) {
      logWarn("[tinyanalytics] session start failed", error);
    }
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      closeSession(END_REASON_VISIBILITY_CHANGE);
    } else if (document.visibilityState === "visible") {
      void startVisibleSession();
    }
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

  function init() {
    logInfo("[tinyanalytics] init", { endpointBase: endpointBase, includeReferrer: includeReferrer });
    clientIdBytes = loadOrCreateClientId();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", function () {
      closeSession(END_REASON_PAGE_HIDE);
    });
    window.addEventListener("pageshow", function () {
      void startVisibleSession();
    });
    window.addEventListener("popstate", trackPageView);
    window.addEventListener("hashchange", trackPageView);
    patchHistoryMethod("pushState");
    patchHistoryMethod("replaceState");
    void startVisibleSession();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
