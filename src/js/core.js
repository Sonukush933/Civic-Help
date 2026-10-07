const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const CITY_ALIASES = {
  "new delhi": "Delhi",
  "delhi": "Delhi",
  "mumbai": "Mumbai",
  "pune": "Pune",
  "bengaluru": "Bengaluru",
  "bangalore": "Bengaluru",
  "kolkata": "Kolkata",
  "calcutta": "Kolkata",
};
const normalizeCityName = (value) => {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const match = CITY_ALIASES[String(raw).toLowerCase()];
  if (match) return match;
  return Object.prototype.hasOwnProperty.call(CITIES, raw) ? raw : raw;
};
const S = {
  lang: "en",
  city: "",
  area: "",
  tab: "home",
  mf: "all",
  sel: null,
  z: 1,
  uf: "all",
  contacts: [],
  big: false,
  hc: false,
  rm: false,
  weak: false,
  unread: 2,
  instDone: false,
  claim: "",
  res: null,
  scroll: null,
  location: null,
  locationStatus: "unknown",
};
function sanitizeAreaValue(value) {
  if (value == null) return "";
  const text = String(value).trim();
  return /demo|sample|mock/i.test(text) ? "" : text;
}
try {
  const saved = JSON.parse(localStorage.getItem("ch") || "{}");
  if (saved && typeof saved === "object") {
    if (saved.area != null) saved.area = sanitizeAreaValue(saved.area);
    if (saved.locationStatus !== "manual" || !saved.city) saved.city = "";
    else saved.city = normalizeCityName(saved.city);
    Object.assign(S, saved);
  }
  S.area = sanitizeAreaValue(S.area);
} catch (e) {}
const save = () => {
  try {
    localStorage.setItem(
      "ch",
      JSON.stringify({
        lang: S.lang,
        city: S.city,
        area: S.area,
        big: S.big,
        hc: S.hc,
        rm: S.rm,
        contacts: S.contacts,
        locationStatus: S.locationStatus,
      }),
    );
  } catch (e) {}
};
const t = (k) => (T[S.lang] && T[S.lang][k]) || T.en[k];
const ic = (n, c = "") =>
  `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const place = () => (S.area || S.city || (S.locationStatus === "ready" ? "Current location" : S.locationStatus === "manual" ? "Selected area" : "Location unavailable"));
const gmap = (q, lat, lng) => {
  if (S.location && Number.isFinite(Number(S.location.lat)) && Number.isFinite(Number(S.location.lng)) && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    const origin = `${S.location.lat},${S.location.lng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(lat + "," + lng)}`;
  }
  return "";
};
const externalUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (e) {
    return "";
  }
};
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let tt;
const toast = (m) => {
  const e = $("#toast");
  e.textContent = m;
  e.classList.add("on");
  clearTimeout(tt);
  tt = setTimeout(() => e.classList.remove("on"), 2400);
};
let lastFocus;
function openSheet(h) {
  $("#sb").innerHTML = h;
  const s = $("#sheet");
  lastFocus = document.activeElement;
  s.classList.add("on");
  setTimeout(() => {
    const f = $("#sb [data-focus],#sb button");
    f && f.focus();
  }, 60);
}
function closeSheet() {
  $("#sheet").classList.remove("on");
  lastFocus && lastFocus.focus && lastFocus.focus();
}
const src = (u) => u.src;
const badge = (s) =>
  `<span class="pill ${ST[s][0]}">${ic(ST[s][2], "s")}${ST[s][1]}</span>`;
function applyPrefs() {
  const r = document.documentElement;
  r.classList.toggle("big", S.big);
  r.classList.toggle("hc", S.hc);
  r.classList.toggle("rm", S.rm);
  r.lang = S.lang;
}
function online() {
  return !S.weak && navigator.onLine;
}
const TABS = [
  ["home", "home"],
  ["map", "map"],
  ["updates", "bell"],
  ["help", "life"],
  ["more", "more"],
];
function chrome() {
  const nav = TABS.map(
    ([k, i]) =>
      `<button data-act="go:${k}" ${S.tab === k ? 'aria-current="page"' : ""}>${ic(i)}<span>${t(k)}</span>${k === "updates" && S.unread ? '<span class="dot" aria-label="New updates"></span>' : ""}</button>`,
  ).join("");
  $("#bn").innerHTML = nav;
  $("#hd").innerHTML =
    `<div class="hi"><div class="h1r"><button class="brand" data-act="go:home" aria-label="CivicHelp home"><span class="logo">${ic("pin")}</span><div><b>CivicHelp</b><small>Public gathering assistance</small></div></button><button class="locb" data-act="sheet:city" aria-label="Change location, currently ${S.locationStatus === "ready" || S.locationStatus === "manual" ? esc(place()) : "not detected"}">${S.locationStatus === "ready" || S.locationStatus === "manual" ? esc(place()) : "Find location"}${ic("chev", "s")}</button></div><nav class="tn" aria-label="Main">${nav}</nav><div class="h2r"><span>${S.locationStatus === "ready" ? "Using your current location · " + esc(place()) : S.locationStatus === "denied" ? "Location permission was denied" : S.locationStatus === "unavailable" ? "Your location is currently unavailable" : S.locationStatus === "timeout" ? "Location request timed out" : S.locationStatus === "manual" ? "Using selected area · nearby search unavailable" : S.locationStatus === "requesting" || S.locationStatus === "resolving" ? "Getting your location…" : S.locationStatus === "unsupported" ? "This browser does not support location" : S.locationStatus === "error" ? "Could not detect location" : "Location not detected"}</span><span class="pill p-v">${ic("lock", "s")}Location used for nearby results</span></div></div>`;
}

/* Loading/error/stale notice for API-driven sections. Returns "" when data is fine,
   so the existing UI is unchanged in the normal case. Uses the existing .warn style. */
const DATA_MSG = {
  places: "Couldn\u2019t load nearby places.",
  updates: "Couldn\u2019t load verified updates.",
  numbers: "Couldn\u2019t load emergency numbers.",
};
function dataNotice(keys) {
  const bad = keys.filter((k) => DATA.status[k] && DATA.status[k].state === "error" && !DATA[k].length);
  if (bad.length)
    return `<div class="warn rv" role="alert">${ic("alert")}<div><b>${bad.map((k) => DATA_MSG[k]).join(" ")}</b>Check your connection.<br><button class="tx" data-act="retry">Try again</button></div></div>`;
  const old = keys.map((k) => DATA.status[k]).filter((x) => x && x.state === "stale");
  if (old.length) {
    const at = old[0].meta.fetchedAt;
    return `<div class="warn rv" role="status">${ic("alert")}<div><b>Showing saved information.</b>${at ? "Last updated " + API.fmtAgo(at) + "." : "Saved essentials only."}</div></div>`;
  }
  return "";
}
