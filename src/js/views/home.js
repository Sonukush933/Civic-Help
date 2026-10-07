function statusCard() {
  const on = online();
  return `<div class="stat rv ${on ? "" : "weak"}"><b><span class="sd"></span>${on ? S.locationStatus === "ready" ? "Online · Live location data" : "Online · Location needed for nearby results" : "Limited connection · Saved civic essentials"}</b><span>Works offline</span></div>`;
}
function nearCards() {
  if (!S.location || !DATA.places.length) {
    return `<div class="mut sm">${DATA.status.places && DATA.status.places.state === "loading" ? "Searching OpenStreetMap for nearby places…" : S.locationStatus === "denied" ? "Location permission was denied. Nearby places are not shown." : S.locationStatus === "unavailable" ? "Your location is currently unavailable. Nearby places are not shown." : S.locationStatus === "timeout" ? "Location request timed out. Nearby places are not shown." : S.locationStatus === "error" ? "Could not determine device location. Nearby places are not shown." : S.locationStatus === "resolving" ? "Resolving your location before searching nearby…" : "Allow device location to find real nearby places."}</div>`;
  }
  return NEARTYPES.map((k) => {
    const p = DATA.places.filter((x) => x.t === k && x.d != null).sort((a, b) => a.d - b.d)[0],
      T = TYPES[k];
    if (!p) return "";
    const directions = gmap(p.name, p.lat, p.lng);
    const website = externalUrl(p.website);
    return `<div class="near" role="listitem" data-place-id="${esc(p.id)}"><span class="tile" style="background:${T.b};color:${T.c}">${ic(T.i)}</span><h3>${esc(p.name || "Unnamed " + T.n.toLowerCase())}</h3><span class="stt">${T.n}</span><span class="d">${Math.round(p.d)} m away</span>${p.s ? `<span class="stt">${esc(p.s)}</span>` : ""}${p.address ? `<span class="stt">${esc(p.address)}</span>` : ""}${p.phone ? `<a class="stt" href="tel:${encodeURIComponent(p.phone)}">${esc(p.phone)}</a>` : ""}${website ? `<a class="stt" target="_blank" rel="noopener" href="${esc(website)}">Website</a>` : ""}${p.source ? `<span class="stt">${esc(p.source)}</span>` : ""}<button class="btn" data-act="sel:${esc(p.id)}" aria-label="Show ${esc(p.name || T.n)} on map">Show on map</button>${directions ? `<a class="btn" target="_blank" rel="noopener" href="${directions}" aria-label="Directions to ${esc(p.name || T.n)}">Directions</a>` : ""}</div>`;
  }).join("");
}
function updCard(u, full) {
  return `<article class="upd"><div class="top"><div><div class="row" style="margin-bottom:6px">${badge(u.st)}</div><h3>${u.title}</h3></div></div><p class="mut" style="color:var(--ink)">${u.body}</p><div class="top" style="align-items:flex-end"><div class="meta"><b>${src(u)}</b><span>${u.time} · ${u.ago}</span></div><button class="vs" data-act="sheet:src${u.id}">View source</button></div><details><summary>Why is this ${u.st === "v" ? "verified" : u.st === "u" ? "unverified" : "marked incorrect"}?</summary><p>${u.why}</p></details></article>`;
}
function miniMapPreview() {
  if (!S.location || typeof L === "undefined") {
    return `<div class="map" style="min-height:160px;border-radius:18px;border:1px solid var(--line);display:grid;place-items:center"><div class="sec" style="justify-items:center"><span class="mut sm">A real map is shown after device location is detected.</span><button class="bg" data-act="loc">Use my location</button></div></div>`;
  }
  return `<div class="map" style="position:relative;overflow:hidden;border-radius:18px;border:1px solid var(--line);"><div id="home-map-canvas" role="img" aria-label="OpenStreetMap showing your location and nearby facilities" style="height:180px;width:100%;overflow:hidden"></div><button class="chip" style="left:10px;top:10px" data-act="go:map">Open full map</button></div>`;
}
let homeMapInst = null;
let homeMapHost = null;
function bindHome() {
  const host = document.getElementById("home-map-canvas");
  if (!host || typeof L === "undefined" || !S.location) return;
  if (homeMapInst && homeMapHost !== host) {
    homeMapInst.remove();
    homeMapInst = null;
  }
  if (!homeMapInst) {
    homeMapInst = L.map(host, { zoomControl: false, scrollWheelZoom: false }).setView([S.location.lat, S.location.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(homeMapInst);
    L.control.zoom({ position: "topright" }).addTo(homeMapInst);
    homeMapHost = host;
  }
  homeMapInst.eachLayer((layer) => {
    if (layer instanceof L.CircleMarker) homeMapInst.removeLayer(layer);
  });
  L.circleMarker([S.location.lat, S.location.lng], { radius: 7, color: "#0E7A55", fillColor: "#0E7A55", fillOpacity: 0.8 }).addTo(homeMapInst).bindPopup("Your current location");
  DATA.places.forEach((p) => {
    if (p.lat == null || p.lng == null) return;
    const type = TYPES[p.t] || TYPES.water;
    const marker = L.circleMarker([p.lat, p.lng], { radius: 6, color: type.c, fillColor: type.b, fillOpacity: 0.95, weight: 2 }).addTo(homeMapInst);
    const website = externalUrl(p.website);
    marker.bindPopup(`<strong>${esc(p.name || type.n)}</strong><br>${Math.round(p.d)} m away${p.address ? `<br>${esc(p.address)}` : ""}${p.phone ? `<br><a href="tel:${encodeURIComponent(p.phone)}">${esc(p.phone)}</a>` : ""}${website ? `<br><a href="${esc(website)}" target="_blank" rel="noopener">Website</a>` : ""}<br><a href="${gmap(p.name, p.lat, p.lng)}" target="_blank" rel="noopener">Directions</a>`);
  });
  const points = [[S.location.lat, S.location.lng]].concat(DATA.places.filter((p) => p.lat != null && p.lng != null).map((p) => [p.lat, p.lng]));
  if (points.length > 1) homeMapInst.fitBounds(L.latLngBounds(points), { padding: [20, 20], maxZoom: 14 });
  else homeMapInst.setView([S.location.lat, S.location.lng], 14);
  setTimeout(() => homeMapInst && homeMapInst.invalidateSize(), 0);
}
function Home() {
  const wk = online()
    ? ""
    : `<div class="warn rv">${ic("alert")}<div><b>Limited connection</b>Showing saved essential information.</div></div>`;
  const weather = DATA.weather || {};
  const weatherTemp = weather.temp_c != null ? Math.round(weather.temp_c) + "°C" : "Weather unavailable";
  const weatherFeels = weather.feels_like_c != null ? "Feels " + Math.round(weather.feels_like_c) + "°C" : "";
  const weatherRain = weather.rain_probability != null ? "Rain " + Math.round(weather.rain_probability) + "%" : "";
  const weatherLabel = weather.condition || "Weather unavailable right now.";
  const weatherUpdated = weather.updated_label || "Not available";
  const weatherHint = weather.condition ? "Current weather from Open-Meteo at your detected location." : S.location ? "Live weather is unavailable right now." : "Location required for weather.";
  const nearbyCount = DATA.places.filter((p) => p.d != null).length;
  const locationLabel = S.locationStatus === "ready" ? `Using your current location · ${esc(place())}` : S.locationStatus === "denied" ? "Location permission was denied" : S.locationStatus === "unavailable" ? "Your location is currently unavailable" : S.locationStatus === "timeout" ? "Location request timed out" : S.locationStatus === "manual" ? `Using selected area · ${esc(S.city)}` : S.locationStatus === "requesting" || S.locationStatus === "resolving" ? "Getting your location…" : S.locationStatus === "unsupported" ? "This browser does not support location" : S.locationStatus === "error" ? "Could not detect location" : "Location not detected";
  return `${statusCard()}${dataNotice(["places", "updates"])}
 <div class="hero rv"><h1>${t("h1")}</h1><p>${t("sub")}</p></div>
 <div class="two-c"><div class="col">
 <section class="card loc rv"><div class="top"><span class="tile t-g">${ic("pin")}</span><div><span class="mut sm">Current location</span><b>${locationLabel}</b><span class="mut sm">${S.location ? `${S.location.lat.toFixed(5)}, ${S.location.lng.toFixed(5)} · ±${Math.round(S.location.accuracy)} m accuracy` : S.locationStatus === "manual" ? "Nearby search requires device location" : "No coordinates available"}</span></div><button data-act="loc">${S.locationStatus === "requesting" ? "Getting your location…" : "Use my location"}</button></div><div class="ft"><span>${ic("clock", "s")}${DATA.status.places && DATA.status.places.meta ? "Updated " + API.fmtAgo(DATA.status.places.meta.fetchedAt) : "Nearby data requires location"}</span><span style="color:var(--g);font-weight:600">${ic("lock", "s")}Location used for live results</span></div></section>
 <section class="card rv" style="background:#FFFCFB;border-color:#F1CFCA"><div class="row" style="flex-wrap:nowrap;margin-bottom:12px"><span class="tile t-r">${ic("alert")}</span><div style="flex:1;min-width:0"><h2>${t("emerg")}</h2><p class="mut sm">Need immediate assistance?</p></div><span class="pill p-v" style="flex:none">${ic("check", "s")}Official</span></div>
 <a class="btn br sosb" href="tel:112">${ic("phone")}${t("call")}</a>
 <p class="mut sm" style="text-align:center;margin:10px 0">India’s emergency response number</p>
 <div class="g3"><a class="btn" href="tel:108"><span class="tile t-r">${ic("hosp")}</span>Medical</a><a class="btn" href="tel:100"><span class="tile t-g">${ic("shield")}</span>Police</a><a class="btn" href="tel:101"><span class="tile t-a">${ic("bolt")}</span>Fire</a></div></section>
 <section class="card rv"><div class="hd2"><div><h2>${t("near")}</h2><p class="mut">${S.location ? "Real OpenStreetMap places nearest to your location" : "Location required for nearby search"}</p></div><button class="tx" data-act="go:map">${t("seeall")}</button></div><div class="scroll" role="list">${nearCards()}</div></section>
 <section class="card rv"><div class="hd2"><div><h2>${t("explore")}</h2><p class="mut">Water, toilets, medical &amp; more</p></div><button class="tx" data-act="go:map">Open full map ${ic("arrow", "s")}</button></div>${miniMapPreview()}<div class="row sb" style="margin-top:12px"><b>${nearbyCount} useful places nearby</b><button class="bg" data-act="go:map">Explore map</button></div></section>
 </div><div class="col">
 <section class="card rv"><div class="hd2"><div><h2>${t("vupd")}</h2><p class="mut">${DATA.updates.length ? "Important information from trusted sources" : "Live official-source feed is unavailable"}</p></div><button class="tx" data-act="go:updates">All</button></div><div class="sec">${DATA.updates.slice(
   0,
   2,
 )
   .map((u) => updCard(u))
   .join(
     "",
   ) || '<p class="mut">No live updates available.</p>'}</div></section>
 <section class="card wx rv"><div class="row sb"><b>${t("wx")}</b><span class="mut sm">${weatherUpdated}</span></div><div class="row sb"><div class="row" style="flex-wrap:nowrap;gap:12px"><span style="color:#F2C25B"><svg class="i" style="width:44px;height:44px" viewBox="0 0 24 24" aria-hidden="true">${I.cloud}</svg></span><div><div class="t">${weatherTemp}</div><span class="mut">${weatherLabel}</span></div></div><div class="sec" style="gap:6px;justify-items:end"><span class="pill pl">${weatherRain || "Rain unavailable"}</span><span class="pill pl">${weatherFeels || "Feels unavailable"}</span></div></div><div class="tip">${weatherHint}</div><button class="bw" data-act="sheet:wx">Weather details</button></section>
 <section class="card rv"><div class="row" style="flex-wrap:nowrap;margin-bottom:12px"><span class="tile t-g">${ic("shield")}</span><div style="min-width:0"><h2>${t("safe")}</h2><p class="mut sm">Send a simple safety status to someone you trust.</p></div></div><div class="two"><button class="bg okbtn" data-act="safe">${ic("check")}${t("imsafe")}</button><button data-act="sheet:contacts">Trusted contacts${S.contacts.length ? " (" + S.contacts.length + ")" : ""}</button></div><p class="mut sm" style="text-align:center;margin-top:10px">Your location is never publicly displayed. Opt-in only.</p></section>
 <div class="two rv"><section class="card sq"><span class="tile t-g">${ic("scale")}</span><div><h3>Legal help</h3><p class="mut sm">Official resources only</p></div><button class="bd" data-act="go:help">Open</button></section><section class="card sq"><span class="tile t-a">${ic("search")}</span><div><h3>Check a claim</h3><p class="mut sm">Pause, check, share</p></div><button data-act="go:updates:check">Check</button></section></div>
 </div></div>
 ${wk}
 ${S.instDone ? "" : `<div class="inst rv"><span class="tile t-g">${ic("down")}</span><div><b>Install CivicHelp</b><p class="mut sm">Quick access &amp; offline essentials.</p></div><button class="bg" data-act="install">Install</button></div>`}
 <p class="foot">Neutral public utility. No tracking, no profiling.<br>Sources shown on every update.</p>`;
}
