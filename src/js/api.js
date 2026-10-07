/* CivicHelp API layer (Phase 1).
   The UI must read data ONLY through window.API / window.DATA, never from
   mock files or fetch() directly. Same functions work for mock and live backend.

   Every call resolves to { data, meta } where meta = { source: "live"|"mock"|"cache"|"bundled",
   stale, fetchedAt, demo, error? } and rejects with ApiError { kind, status } when nothing
   (network, cache, bundled fallback) can answer. kind: config | offline | network | timeout | http.
   Expected live response shape: { "data": ... } (a bare payload is also accepted). */
(function (w) {
  "use strict";
  var C = w.CH_CONFIG;
  var CACHE_KEY = "ch.cache.v4:";
  try {
    var legacyKeys = Object.keys(localStorage).filter(function (k) { return /^ch\.cache\.v[0-3]:/.test(k); });
    legacyKeys.forEach(function (k) { try { localStorage.removeItem(k); } catch (_) {} });
  } catch (_) {}

  function ApiError(kind, message, status) {
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.message = message || kind;
  }
  ApiError.prototype = Object.create(Error.prototype);

  var status = { pending: 0, lastError: null };
  var listeners = [];
  function emit() {
    listeners.forEach(function (f) { try { f(status); } catch (e) {} });
  }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- cache (localStorage, public data only) ---------- */
  function cacheGet(k) { try { return JSON.parse(localStorage.getItem(CACHE_KEY + k)); } catch (e) { return null; } }
  function cacheSet(k, raw) { try { localStorage.setItem(CACHE_KEY + k, JSON.stringify({ at: Date.now(), raw: raw })); } catch (e) {} }

  /* ---------- http with timeout + retry ---------- */
  function http(method, path, body, timeout) {
    if (!C.API_BASE) return Promise.reject(new ApiError("config", "API_BASE is not set"));
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { ctl && ctl.abort(); }, timeout);
    var headers = { Accept: "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    return Promise.resolve()
      .then(function () {
        return fetch(C.API_BASE + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: ctl && ctl.signal, credentials: "omit", cache: "no-store" });
      })
      .then(function (res) {
        if (!res.ok) throw new ApiError("http", "HTTP " + res.status, res.status);
        return res.json();
      })
      .catch(function (e) {
        if (e instanceof ApiError) throw e;
        if (e && e.name === "AbortError") throw new ApiError("timeout", "Request timed out");
        throw new ApiError(navigator.onLine === false ? "offline" : "network", e && e.message);
      })
      .then(function (r) { clearTimeout(timer); return r; }, function (e) { clearTimeout(timer); throw e; });
  }
  async function withRetry(fn, retries) {
    var last;
    for (var i = 0; i <= retries; i++) {
      try { return await fn(); } catch (e) {
        last = e;
        var retryable = e.kind === "timeout" || e.kind === "network" || (e.kind === "http" && e.status >= 500);
        if (!retryable || i === retries) break;
        await sleep(400 * Math.pow(2, i));
      }
    }
    throw last;
  }
  var unwrap = function (raw) { return raw && raw.data !== undefined ? raw.data : raw; };

  /* spec: { key, method, path, body, mock(), normalize(raw), cache(false to disable), fallback() } */
  async function call(spec) {
    status.pending++; emit();
    try {
      var raw, src;
      if (C.API_MODE === "mock") {
        if (C.MOCK_DELAY_MS) await sleep(C.MOCK_DELAY_MS);
        raw = await spec.mock(); src = "mock";
      } else {
        raw = unwrap(await withRetry(function () { return http(spec.method || "GET", spec.path, spec.body, C.TIMEOUT_MS); }, spec.retries != null ? spec.retries : C.RETRIES));
        src = "live";
        if (spec.cache !== false) cacheSet(spec.key, raw);
      }
      status.lastError = null;
      return { data: spec.normalize ? spec.normalize(raw) : raw, meta: { source: src, stale: false, fetchedAt: Date.now(), demo: src === "mock" } };
    } catch (e) {
      status.lastError = e;
      if (C.API_MODE !== "mock" && spec.cache !== false) {
        var c = cacheGet(spec.key);
        if (c) return { data: spec.normalize ? spec.normalize(c.raw) : c.raw, meta: { source: "cache", stale: true, fetchedAt: c.at, error: e.kind } };
      }
      if (C.API_MODE !== "mock" && spec.fallback) {
        var fb = spec.fallback();
        return { data: spec.normalize ? spec.normalize(fb) : fb, meta: { source: "bundled", stale: true, fetchedAt: null, error: e.kind } };
      }
      throw e;
    } finally { status.pending--; emit(); }
  }

  /* ---------- helpers ---------- */
  function qs(o) {
    var p = Object.keys(o).filter(function (k) { return o[k] != null && o[k] !== ""; }).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); });
    return p.length ? "?" + p.join("&") : "";
  }
  function fmtTime(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase(); }
  function fmtAgo(ts) {
    var m = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
    if (isNaN(m)) return "";
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    if (m < 1440) return Math.round(m / 60) + " hr ago";
    return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  /* Include device coordinates only in location-aware requests; retain six decimal places. */
  function locParams(o) {
    if (!o || o.lat == null || o.lng == null) return {};
    var lat = Number(o.lat), lng = Number(o.lng);
    if (isNaN(lat) || isNaN(lng)) return {};
    return { lat: lat.toFixed(6), lng: lng.toFixed(6) };
  }

  /* ---------- normalizers: backend shape -> UI shape used by the views ---------- */
  var STATUS = { verified: "v", unverified: "u", disputed: "x" };
  function nFacility(f) {
    return { id: f.id, t: f.category, name: f.name || "", d: f.distance_m != null ? f.distance_m : null, s: f.status_label || f.status || "", x: f.map ? f.map.x : null, y: f.map ? f.map.y : null, lat: f.latitude, lng: f.longitude, address: f.address || "", phone: f.phone || "", website: f.website || "", accessible: f.accessible, source: f.source || null, searchRadiusM: f.search_radius_m || null, demo: !!f.is_demo };
  }
  function nUpdate(u) {
    var pub = u.published_at;
    return { id: u.id, st: STATUS[u.status] || "u", title: u.title, body: u.body, src: (u.source && u.source.name) || "", srcUrl: (u.source && u.source.url) || null, why: u.verification_reason || "", time: pub ? fmtTime(pub) : (u.display && u.display.time) || "", ago: pub ? fmtAgo(u.updated_at || pub) : (u.display && u.display.ago) || "", publishedAt: pub || null, expiresAt: u.expires_at || null };
  }
  /* emergency rows keep the array shape the Help view already uses */
  function nNumber(n) { return [n.number, n.label, n.description, n.icon || "phone", n.tone || "t-g"]; }
  function nClaim(r) {
    var label = r.source_label || (r.sources && r.sources.length ? r.sources.map(function (s) { return s.name; }).join(", ") : "") + (r.checked_at ? " · " + fmtTime(r.checked_at) : "");
    return { st: STATUS[r.status] || "u", m: r.explanation, src: label, sources: r.sources || [], checkedAt: r.checked_at || null };
  }
  var list = function (raw) { return Array.isArray(raw) ? raw : []; };

  /* ---------- public API ---------- */
  var API = {
    config: C, status: status, ApiError: ApiError, fmtAgo: fmtAgo,
    subscribe: function (f) { listeners.push(f); return function () { listeners = listeners.filter(function (x) { return x !== f; }); }; },

    resolveLocation: function (lat, lng) {
      if (lat == null || lng == null) return Promise.resolve({ data: { city: "", area: "", state: "" }, meta: { source: "device", stale: false, fetchedAt: Date.now() } });
      return call({ key: "location:" + lat + ":" + lng, path: "/api/location/resolve" + qs({ lat: lat, lng: lng }), cache: false, normalize: function (raw) { return raw || {}; } });
    },
    getCurrentEvent: function (o) {
      o = o || {};
      return call({ key: "event:" + (o.city || ""), path: "/api/events" + qs(Object.assign({ city: o.city }, locParams(o))), mock: function () { return { id: "demo-" + (o.city || "mumbai").toLowerCase(), city: o.city, is_demo: true }; } });
    },
    getFacilities: function (o) {
      o = o || {};
      if (o.lat == null || o.lng == null) return Promise.reject(new ApiError("location", "Device location is required for nearby search"));
      var params = Object.assign({ city: o.city, event_id: o.eventId, category: o.category, radius: o.radius || 5000 }, locParams(o));
      return call({ key: "facilities:" + o.lat + ":" + o.lng + ":" + (o.category || "all") + ":" + (o.radius || 5000), path: "/api/facilities" + qs(params), cache: false,
        mock: function () { return CH_MOCK.facilities.map(function (f) { return Object.assign({ is_demo: true }, f); }).filter(function (f) { return !o.category || f.category === o.category; }); },
        normalize: function (raw) { return list(raw).map(nFacility); } });
    },
    getFacility: function (id) {
      return call({ key: "facility:" + id, path: "/api/facilities/" + encodeURIComponent(id),
        mock: function () { var f = CH_MOCK.facilities.filter(function (x) { return String(x.id) === String(id); })[0]; if (!f) throw new ApiError("http", "Not found", 404); return Object.assign({ is_demo: true }, f); },
        normalize: nFacility });
    },
    getUpdates: function (o) {
      o = o || {};
      return call({ key: "updates:" + (o.city || ""), path: "/api/updates" + qs({ city: o.city, event_id: o.eventId }), cache: false, mock: function () { return CH_MOCK.updates; },
        normalize: function (raw) { return list(raw).map(nUpdate); } });
    },
    getEmergencyResources: function (o) {
      o = o || {};
      return call({ key: "emergency:" + (o.city || ""), path: "/api/emergency" + qs({ city: o.city }), mock: function () { return CH_MOCK.emergency; },
        fallback: function () { return CH_MOCK.emergency; }, /* works offline; bundled snapshot is flagged meta.source="bundled" */
        normalize: function (raw) { return list(raw).map(nNumber); } });
    },
    getWeather: function (o) {
      o = o || {};
      if (o.lat == null || o.lng == null) return Promise.reject(new ApiError("location", "Device location is required for local weather"));
      return call({ key: "weather:" + o.lat + ":" + o.lng, path: "/api/weather" + qs(Object.assign({ city: o.city }, locParams(o))), cache: false, mock: function () { return Object.assign({ is_demo: true }, CH_MOCK.weather); } });
    },
    getClaimResult: function (claim, o) {
      return call({ key: "claim", method: "POST", path: "/api/claims/check", body: { claim: claim }, cache: false, retries: 1,
        mock: function () { return CH_MOCK.checkClaim(claim, o); }, normalize: nClaim });
    },
    getTrustedContacts: function () { /* Phase 14 moves this to a secure store; for now contacts stay on-device */
      return Promise.resolve().then(function () {
        var c = []; try { c = JSON.parse(localStorage.getItem("ch") || "{}").contacts || []; } catch (e) {}
        return { data: c, meta: { source: "device", stale: false, fetchedAt: Date.now() } };
      });
    },
    sendSafetyCheckIn: function (o) { /* location is OFF unless includeLocation === true (explicit opt-in) */
      o = o || {};
      var msg = o.message || "I\u2019m safe. Sent via CivicHelp. No location shared.";
      if (C.API_MODE === "mock") {
        var nums = (o.contacts || []).map(function (c) { return c.p; }).join(",");
        return Promise.resolve({ data: { channel: "sms-link", message: msg, smsHref: "sms:" + nums + "?body=" + encodeURIComponent(msg) }, meta: { source: "mock", stale: false, fetchedAt: Date.now(), demo: true } });
      }
      return call({ key: "checkin", method: "POST", path: "/api/safety/check-in", body: { message: msg, includeLocation: o.includeLocation === true }, cache: false, retries: 0 });
    },
    submitReport: function (r) { return call({ key: "report", method: "POST", path: "/api/reports", body: r, cache: false, retries: 0, mock: function () { return { id: "demo-report", status: "pending" }; } }); },

    /* Fills window.DATA for the views. Never throws; each key records ok | stale | error. */
    bootstrap: async function (ctx) {
      ctx = ctx || {};
      var state = typeof S !== "undefined" ? S : {};
      var baseCtx = {
        city: ctx.city || state.city,
        lat: ctx.lat != null ? ctx.lat : (state.location && state.location.lat != null ? state.location.lat : null),
        lng: ctx.lng != null ? ctx.lng : (state.location && state.location.lng != null ? state.location.lng : null),
      };
      var jobs = { numbers: API.getEmergencyResources(baseCtx) };
      if (baseCtx.city) jobs.updates = API.getUpdates(baseCtx);
      else {
        DATA.updates = [];
        DATA.status.updates = { state: "location" };
      }
      if (baseCtx.lat != null && baseCtx.lng != null) {
        jobs.places = API.getFacilities(baseCtx);
        jobs.weather = API.getWeather(baseCtx);
      } else {
        DATA.places = [];
        DATA.weather = null;
        DATA.status.places = { state: "location" };
        DATA.status.weather = { state: "location" };
      }
      var keys = Object.keys(jobs);
      var res = await Promise.allSettled(keys.map(function (k) { return jobs[k]; }));
      keys.forEach(function (k, i) {
        var r = res[i];
        if (r.status === "fulfilled") {
          if (k === "weather") DATA.weather = r.value.data;
          else DATA[k] = r.value.data;
          DATA.status[k] = { state: r.value.meta.stale ? "stale" : "ok", meta: r.value.meta };
        } else {
          if (k === "places") DATA.places = [];
          if (k === "weather") DATA.weather = null;
          DATA.status[k] = { state: "error", error: r.reason };
        }
      });
      return DATA;
    },
  };
  w.DATA = { places: [], updates: [], numbers: [], weather: null, status: {} };
  w.API = API;
})(window);
