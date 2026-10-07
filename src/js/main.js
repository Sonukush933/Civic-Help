const V = { home: Home, map: MapV, updates: Upd, help: Help, more: More },
  B = { home: bindHome, map: bindMap, updates: bindUpd };
function centerMapView(forceCenter) {
  if (typeof mapInst === "undefined" || !mapInst || typeof L === "undefined") return;
  const list = (DATA.places || []).filter((p) => p.lat != null && p.lng != null && (S.mf === "all" || p.t === S.mf));
  if (!list.length) {
    if (S.location && forceCenter) mapInst.setView([S.location.lat, S.location.lng], 14);
    return;
  }
  if (S.sel) {
    const selected = list.find((p) => p.id === S.sel);
    if (selected) {
      mapInst.setView([selected.lat, selected.lng], Math.max(14, mapInst.getZoom()));
      return;
    }
  }
  const bounds = L.latLngBounds(list.map((p) => [p.lat, p.lng]));
  if (S.location && Number.isFinite(S.location.lat) && Number.isFinite(S.location.lng)) {
    bounds.extend([S.location.lat, S.location.lng]);
  }
  if (forceCenter || !S.sel) {
    mapInst.fitBounds(bounds, { padding: [28, 28] });
  }
}
const sh = (h, b) =>
  `<div class="row sb"><h2>${h}</h2><button class="tx" data-act="close" aria-label="Close" data-focus>${ic("x")}</button></div>${b}`;
const SH = {
  city: () =>
    sh(
      "Choose city",
      `<button class="bg" data-act="loc">Use my current location</button><div class="sec">${Object.keys(CITIES)
        .map(
          (c) =>
            `<button class="sw" style="${S.locationStatus === "manual" && c === S.city ? "border-color:var(--g);background:var(--gbg)" : ""}" data-act="city:${c}"><span>${ic("pin", "s")} ${c}</span></button>`,
        )
        .join("")}</div>`,
    ),
  area: () =>
    sh(
      esc(place()),
      `<p class="mut">${S.locationStatus === "ready" ? "Using your current device location." : S.locationStatus === "manual" ? "Using selected area. Nearby services require device location." : "Nearby services require device location. Manual city selection does not create a location pin."}</p><div class="sec"><div class="row" style="flex-wrap:nowrap"><span class="tile t-g">${ic("pin")}</span><div><b>${S.locationStatus === "ready" ? esc(place()) : S.locationStatus === "manual" ? esc(S.city) : "Location not available"}</b><p class="mut sm">${S.location && Number.isFinite(S.location.lat) ? `${S.location.lat.toFixed(5)}, ${S.location.lng.toFixed(5)} · ±${Math.round(S.location.accuracy)} m accuracy · captured ${new Date(S.location.timestamp).toLocaleTimeString()}` : "No coordinates stored"}</p></div></div><div class="row" style="flex-wrap:nowrap"><span class="tile t-g">${ic("lock")}</span><div><b>Location privacy</b><p class="mut sm">Coordinates are sent to CivicHelp and its map, geocoding, and weather providers to return nearby results.</p></div></div></div><button class="bg" data-act="loc">${ic("target", "s")}Use my current location</button>`,
    ),
  wx: () =>
    sh(
      "Forecast",
      `<div class="sec">${DATA.weather ? `<div class="row sb"><b>Current</b><span>${DATA.weather.temp_c == null ? "Unavailable" : `${Math.round(DATA.weather.temp_c)}°C`}</span></div><div class="row sb"><b>Feels like</b><span>${DATA.weather.feels_like_c == null ? "Unavailable" : `${Math.round(DATA.weather.feels_like_c)}°C`}</span></div><div class="row sb"><b>Conditions</b><span>${esc(DATA.weather.condition || "Unavailable")}</span></div><div class="row sb"><b>Rain probability</b><span>${DATA.weather.rain_probability == null ? "Unavailable" : `${Math.round(DATA.weather.rain_probability)}%`}</span></div><div class="row sb"><b>Updated</b><span>${esc(DATA.weather.updated_label || "Unavailable")}</span></div>` : `<p class="mut" role="status">${S.location ? "Live weather is unavailable right now." : "Location required for weather."}</p>`}</div><p class="mut sm">Current weather from Open-Meteo for your device coordinates.</p>`,
    ),
  legal: () =>
    sh(
      "Legal aid",
      `<p class="mut">Official free legal services are provided through the National Legal Services Authority and state legal services authorities. No legal advice is given in this app.</p><a class="btn bg" href="tel:15100">${ic("phone", "s")}Call 15100</a><a class="btn" target="_blank" rel="noopener" href="https://nalsa.gov.in">${ic("ext", "s")}Visit nalsa.gov.in</a>`,
    ),
  sources: () =>
    sh(
      "Source verification",
      `<p class="mut">Live official-source verification is not configured. CivicHelp cannot currently confirm or dispute claims, and no live source list is available.</p>`,
    ),
  policy: () =>
    sh(
      "Privacy summary",
      `<div class="sec"><p>With permission, your coordinates are sent to CivicHelp and its geocoding, OpenStreetMap, and weather providers to retrieve nearby results.</p><p>We do not publish or sell your location. We do not track political opinions or affiliations.</p><p class="mut sm">Saved preferences and trusted contacts remain on this device.</p></div>`,
    ),
  install: () =>
    sh(
      "Install CivicHelp",
      `<p class="mut">Open your browser menu and choose <b>Add to Home Screen</b> (or <b>Install app</b>) to keep CivicHelp one tap away.</p>`,
    ),
  contacts: () =>
    sh(
      "Trusted contacts",
      `<p class="mut sm">Only people you add can receive your safety status. Location is never included.</p><div class="sec">${S.contacts.map((c, i) => `<div class="row sb" style="flex-wrap:nowrap"><div style="min-width:0"><b>${esc(c.n)}</b><br><span class="mut sm">${esc(c.p)}</span></div><button class="tx" data-act="delc:${i}" aria-label="Remove ${esc(c.n)}">${ic("trash")}</button></div>`).join("") || '<p class="mut sm">No contacts yet.</p>'}</div>${S.contacts.length < 5 ? `<input class="inp" id="cn" placeholder="Name" aria-label="Contact name" maxlength="30"><input class="inp" id="cp" placeholder="Phone number" inputmode="tel" aria-label="Phone number" maxlength="16"><button class="bg" data-act="addc">${ic("plus", "s")}Add contact</button>` : ""}`,
    ),
};
function srcSheet(id) {
  const u = DATA.updates.find((x) => x.id === id);
  return sh(
    "Source",
    `<div>${badge(u.st)}</div><h3>${u.title}</h3><div class="sec" style="gap:6px"><div><span class="mut sm">Source</span><br><b>${src(u)}</b></div><div><span class="mut sm">Published</span><br><b>${u.time} \u00b7 ${u.ago}</b></div></div><p class="mut">${u.why}</p><button data-act="toast:Thanks. We will review this update.">Report a problem</button>`,
  );
}
const ACT = {
  go(v, a, e, x) {
    S.scroll = x || null;
    if (location.hash === "#/" + v) route();
    else location.hash = "#/" + v;
    closeSheet();
  },
  toast(v) {
    toast(v);
  },
  close: closeSheet,
  sheet(v) {
    openSheet(/^src\d+$/.test(v) ? srcSheet(+v.slice(3)) : SH[v]());
  },
  city(v) {
    S.city = v;
    S.area = "";
    S.location = null;
    S.locationStatus = "manual";
    S.sel = null;
    DATA.places = [];
    DATA.weather = null;
    save();
    closeSheet();
    re();
    toast("Selected " + v + ". Nearby results need device location.");
    API.bootstrap({ city: v }).then(re);
  },
  loc() {
    closeSheet();
    requestUserLocation({ render: true, notify: true });
  },
  sel(v) {
    const selected = DATA.places.find((p) => String(p.id) === String(v));
    const id = selected ? selected.id : null;
    if (S.tab !== "map") {
      S.sel = id;
      ACT.go("map");
      return;
    }
    S.sel = id;
    $$(".mk").forEach((g) => g.classList.toggle("sel", g.dataset.id === String(id)));
    $$(".pi").forEach((p) => p.classList.toggle("sel", p.dataset.id === String(id)));
    const p = selected;
    $("#pd").innerHTML = p
      ? placeCard(p)
      : '<p class="mut sm" style="text-align:center">Tap a marker to see details and directions.</p>';
    centerMapView(true);
    if (p) {
      const r = $(".pi.sel");
      r &&
        r.scrollIntoView({
          block: "nearest",
          behavior: S.rm ? "auto" : "smooth",
        });
    }
  },
  mf(v) {
    S.mf = v;
    S.sel = null;
    re();
  },
  zoom(v) {
    v = +v;
    if (!v) {
      S.sel = null;
      if (mapInst && S.location) mapInst.setView([S.location.lat, S.location.lng], 14);
      if (mapInst) mapInst.closePopup();
      $$(".pi").forEach((p) => p.classList.remove("sel"));
      const detail = $("#pd");
      if (detail) detail.innerHTML = '<p class="mut sm" style="text-align:center">Tap a marker to see details and directions.</p>';
      return;
    }
    if (!mapInst) return;
    if (v > 0) mapInst.zoomIn();
    else mapInst.zoomOut();
  },
  near(v) {
    S.mf = v;
    S.sel = null;
    ACT.go("map");
  },
  uf(v) {
    S.uf = v;
    re();
  },
  async claim() {
    const q = ($("#ci").value || "").trim();
    if (!q) {
      toast("Type a claim first");
      return;
    }
    S.claim = q;
    const box = $("#rbox");
    box.innerHTML =
      '<div class="res" aria-busy="true"><span class="mut sm">Checking official sources\u2026</span></div>';
    try {
      const r = await API.getClaimResult(q, { city: S.city });
      S.res = r.data;
      if ($("#rbox") === box) box.innerHTML = resBox(S.res);
    } catch (e) {
      S.res = null;
      if ($("#rbox") === box)
        box.innerHTML =
          '<div class="res" role="alert"><p>Couldn\u2019t check this claim right now.</p><div class="row"><button data-act="claim">Try again</button></div></div>';
    }
  },
  retry() {
    toast("Retrying\u2026");
    API.bootstrap({ city: S.city }).then(re);
  },
  ex(v) {
    $("#ci").value = v;
    ACT.claim();
  },
  lang(v) {
    S.lang = v;
    save();
    applyPrefs();
    re();
  },
  tog(v) {
    S[v] = !S[v];
    save();
    applyPrefs();
    re();
  },
  safe() {
    if (!S.contacts.length) {
      toast("Add a trusted contact first");
      ACT.sheet("contacts");
      return;
    }
    $$(".okbtn").forEach((b) => {
      b.classList.add("done");
      b.innerHTML = ic("check") + "Status sent";
    });
    toast(
      `Safety status sent to ${S.contacts.length} contact${S.contacts.length > 1 ? "s" : ""}`,
    );
    const a = document.createElement("a");
    a.href =
      "sms:" +
      S.contacts.map((c) => c.p).join(",") +
      "?body=" +
      encodeURIComponent(
        "I\u2019m safe. Sent via CivicHelp. No location shared.",
      );
    a.click();
  },
  addc() {
    const n = ($("#cn").value || "").trim(),
      p = ($("#cp").value || "").replace(/[\s-]/g, "");
    if (!n || !/^\+?\d{10,13}$/.test(p)) {
      toast("Enter a name and a valid phone number");
      return;
    }
    S.contacts.push({ n, p });
    save();
    openSheet(SH.contacts());
    re();
    toast("Contact added");
  },
  delc(v) {
    S.contacts.splice(+v, 1);
    save();
    openSheet(SH.contacts());
    re();
  },
  install() {
    if (S.dp) {
      S.dp.prompt();
      S.dp.userChoice.then((r) => {
        if (r.outcome === "accepted") {
          S.instDone = true;
          re();
        }
      });
      S.dp = null;
    } else ACT.sheet("install");
  },
};
document.addEventListener("click", (e) => {
  if (e.target.id === "sheet") {
    closeSheet();
    return;
  }
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const [k, v, x] = a.dataset.act.split(":");
  if (k === "toast") {
    toast(a.dataset.act.slice(6));
    return;
  }
  if (ACT[k]) ACT[k](v, a, e, x);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
  if (e.key === "Enter" && e.target.id === "ci") ACT.claim();
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.matches("[role=button][data-act]")
  ) {
    e.preventDefault();
    e.target.click();
  }
});
function route(first) {
  const tab = location.hash.replace("#/", "") || "home";
  S.tab = V[tab] ? tab : "home";
  const v = $("#view");
  const paint = () => {
    v.classList.remove("still");
    v.innerHTML = V[S.tab]();
    $$(".rv", v).forEach(
      (el, i) => (el.style.animationDelay = Math.min(i * 55, 400) + "ms"),
    );
    B[S.tab] && B[S.tab]();
    chrome();
    scrollTo({ top: 0, behavior: "instant" });
    v.classList.remove("out");
    if (S.tab === "map") centerMapView(false);
  };
  if (first) {
    chrome();
    v.innerHTML =
      '<div class="sk"></div><div class="sk" style="height:200px"></div><div class="sk"></div>';
    Promise.all([
      API.bootstrap({ city: S.city }),
      new Promise((r) => setTimeout(r, 550)),
    ]).then(paint);
  } else {
    v.classList.add("out");
    setTimeout(paint, S.rm ? 0 : 120);
  }
}
function re() {
  const y = scrollY,
    v = $("#view");
  v.classList.add("still");
  v.innerHTML = V[S.tab]();
  B[S.tab] && B[S.tab]();
  chrome();
  scrollTo({ top: y, behavior: "instant" });
  if (S.tab === "map") centerMapView(false);
}
addEventListener("hashchange", () => route());
addEventListener("online", re);
addEventListener("offline", re);
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  S.dp = e;
});
addEventListener("appinstalled", () => {
  S.instDone = true;
  re();
});
applyPrefs();
let locationRequestPending = false;
function clearLocationResults(state) {
  DATA.places = [];
  DATA.weather = null;
  DATA.status.places = { state: state || "location" };
  DATA.status.weather = { state: state || "location" };
}
function updateLocationMeta(position) {
  const lat = position && position.coords && position.coords.latitude;
  const lng = position && position.coords && position.coords.longitude;
  const accuracy = position && position.coords && position.coords.accuracy;
  const timestamp = position && position.timestamp;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isFinite(accuracy) || accuracy < 0 || !Number.isFinite(timestamp)) {
    S.location = null;
    S.locationStatus = "error";
    clearLocationResults("error");
    save();
    re();
    toast("The browser returned invalid coordinates. Please try location again.");
    return;
  }
  S.location = { lat, lng, accuracy, timestamp };
  S.locationStatus = "resolving";
  S.area = "";
  S.sel = null;
  save();
  clearLocationResults("loading");
  re();
  API.resolveLocation(lat, lng).then((r) => {
    const loc = (r && r.data) || {};
    S.area = sanitizeAreaValue(loc.area);
    S.city = normalizeCityName(loc.city) || normalizeCityName(S.area);
    S.locationStatus = "ready";
    save();
  }).catch((error) => {
    S.city = "Current location";
    S.area = "";
    S.locationStatus = "ready";
    console.error("Could not resolve current location:", error);
    toast("Could not identify your area. Showing nearby results from your coordinates.");
  }).then(() => API.bootstrap({ city: S.city, lat, lng })).then(re);
}
function requestUserLocation(options) {
  options = options || {};
  if (locationRequestPending) return;
  if (!("geolocation" in navigator)) {
    S.location = null;
    S.city = "";
    S.locationStatus = "unsupported";
    clearLocationResults("location");
    save();
    options.render && re();
    options.notify && toast("This browser does not provide device location.");
    return;
  }
  locationRequestPending = true;
  S.location = null;
  S.city = "";
  S.area = "";
  S.locationStatus = "requesting";
  clearLocationResults("location");
  save();
  options.render && re();
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locationRequestPending = false;
      updateLocationMeta(pos);
    },
    (error) => {
      locationRequestPending = false;
      S.location = null;
      S.area = "";
      S.locationStatus = error && error.code === 1 ? "denied" : error && error.code === 2 ? "unavailable" : error && error.code === 3 ? "timeout" : "error";
      clearLocationResults("location");
      save();
      options.render && re();
      if (options.notify) toast(error && error.code === 1
        ? "Location permission was denied. Choose a city manually or allow location to see nearby places."
        : error && error.code === 2
          ? "Your location is currently unavailable. Try again or choose a city manually."
          : error && error.code === 3
            ? "Location request timed out. Try again or choose a city manually."
            : "Could not get your current location. Try again or choose a city manually.");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((error) => console.warn("Service worker registration failed:", error)));
}
S.location = null;
if (!["denied", "manual", "unsupported"].includes(S.locationStatus)) requestUserLocation({ render: false, notify: false });
route(true);
