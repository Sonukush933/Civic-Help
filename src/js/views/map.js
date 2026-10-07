function placeCard(p) {
  const T = TYPES[p.t] || TYPES.water;
  const directions = gmap(p.name, p.lat, p.lng);
  const website = externalUrl(p.website);
  return `<div class="pd"><div class="row" style="flex-wrap:nowrap"><span class="tile" style="background:${T.b};color:${T.c}">${ic(T.i)}</span><div style="min-width:0;flex:1"><h3>${esc(p.name || "Unnamed " + T.n.toLowerCase())}</h3><span class="mut sm">${p.d != null ? Math.round(p.d) + " m away" : ""}${p.s ? " · " + esc(p.s) : ""}</span></div></div>${p.address ? `<p class="mut sm">${esc(p.address)}</p>` : ""}${p.phone ? `<p class="mut sm"><a href="tel:${encodeURIComponent(p.phone)}">${esc(p.phone)}</a></p>` : ""}${website ? `<p class="mut sm"><a target="_blank" rel="noopener" href="${esc(website)}">Website</a></p>` : ""}${p.source ? `<p class="mut sm">Source: ${esc(p.source)}</p>` : ""}<div class="two">${directions ? `<a class="btn bg" target="_blank" rel="noopener" href="${directions}">${ic("nav", "s")}Directions</a>` : ""}<button data-act="sel:0">Close</button></div></div>`;
}
function MapV() {
  const chips = [
    ["all", "All", null],
    ...Object.keys(TYPES).map((k) => [k, TYPES[k].n, TYPES[k].i]),
  ];
  const list = DATA.places.filter((p) => S.mf === "all" || p.t === S.mf).sort(
    (a, b) => (a.d || 999999) - (b.d || 999999),
  );
  const sp = DATA.places.find((p) => String(p.id) === String(S.sel));
  const locationAction = S.locationStatus === "ready" || S.locationStatus === "resolving" || S.locationStatus === "requesting" ? "" : `<button class="bg" data-act="loc">${ic("target", "s")}${S.locationStatus === "denied" ? "Retry location" : "Use my current location"}</button>`;
  const expanded = list.some((p) => p.searchRadiusM === 10000);
  const summary = S.locationStatus === "ready" ? `${list.length} real places near ${esc(place())}.${expanded ? " Search expanded to 10 km to find more places." : ""}` : S.locationStatus === "resolving" ? "Resolving your location…" : S.locationStatus === "requesting" ? "Getting your location…" : S.locationStatus === "denied" ? "Location permission was denied." : S.locationStatus === "unavailable" ? "Your location is currently unavailable." : S.locationStatus === "timeout" ? "Location request timed out." : "Allow device location to search for real nearby places.";
  return `${dataNotice(["places"])}<div class="rv"><h1 style="font-size:clamp(1.4rem,5vw,1.8rem)">${t("explore")}</h1><p class="mut" style="margin-top:4px">${summary}</p>${locationAction}</div>
 <div class="chips rv" role="group" aria-label="Filter places">${chips.map((c) => `<button class="fc" aria-pressed="${S.mf === c[0]}" data-act="mf:${c[0]}">${c[2] ? ic(c[2], "s") : ""}${c[1]}</button>`).join("")}</div>
 <div class="two-c mp"><div class="col"><div class="map rv" id="mapbox"><div id="map-canvas" style="height:320px;width:100%;border-radius:16px;overflow:hidden"></div><span class="chip" style="left:10px;top:10px">${S.locationStatus === "ready" ? `${esc(place())} area` : S.locationStatus === "manual" ? `${esc(place())} selected` : "Location unavailable"}</span><div class="zb"><button data-act="zoom:1" aria-label="Zoom in">${ic("plus")}</button><button data-act="zoom:-1" aria-label="Zoom out">${ic("minus")}</button><button data-act="zoom:0" aria-label="Centre on my position">${ic("target")}</button></div></div>
 <div id="pd" class="rv">${sp ? placeCard(sp) : '<p class="mut sm" style="text-align:center">Tap a marker to see details and directions.</p>'}</div></div>
 <section class="card rv"><h2 style="margin-bottom:6px">Nearest first</h2><div>${list
   .map((p) => {
     const T = TYPES[p.t] || TYPES.water;
     const website = externalUrl(p.website);
     return `<div class="pi${String(p.id) === String(S.sel) ? " sel" : ""}" data-id="${esc(p.id)}"><span class="tile" style="background:${T.b};color:${T.c}">${ic(T.i)}</span><div><h3>${esc(p.name || "Unnamed " + T.n.toLowerCase())}</h3><span class="mut sm">${Math.round(p.d)} m${p.s ? " · " + esc(p.s) : ""}</span>${p.address ? `<span class="mut sm">${esc(p.address)}</span>` : ""}${p.phone ? `<a class="mut sm" href="tel:${encodeURIComponent(p.phone)}">${esc(p.phone)}</a>` : ""}${website ? `<a class="mut sm" href="${esc(website)}" target="_blank" rel="noopener">Website</a>` : ""}${p.source ? `<span class="mut sm">Source: ${esc(p.source)}</span>` : ""}</div><button data-act="sel:${esc(p.id)}" aria-label="Show ${esc(p.name || T.n)} on map">Show</button></div>`;
   })
   .join("") || `<p class="mut sm">${DATA.status.places && DATA.status.places.state === "loading" ? "Searching OpenStreetMap for nearby places…" : S.locationStatus === "denied" ? "Location permission was denied; no nearby places are shown." : S.locationStatus === "manual" ? "Manual city selection does not provide coordinates. Use device location to search nearby." : S.locationStatus === "unavailable" ? "Your location is currently unavailable; no nearby search was made." : S.locationStatus === "timeout" ? "Location request timed out; no nearby search was made." : S.locationStatus === "error" && !S.location ? "Could not determine device location; no nearby search was made." : DATA.status.places && DATA.status.places.state === "error" ? "Nearby search failed. Try again when connected." : "No facilities found for the selected category at this location."}</p>`}</div></section></div>`;
}
let mapInst = null;
let mapLayer = null;
let userMarker = null;
let routeMarker = null;
let mapHost = null;
function centerMapView(forceCenter) {
  if (!mapInst || typeof L === "undefined") return;
  const list = DATA.places.filter((p) => p.lat != null && p.lng != null && (S.mf === "all" || p.t === S.mf));
  if (!list.length) return;
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
function markerColor(type) {
  const cfg = TYPES[type] || TYPES.water;
  return { color: cfg.c, fillColor: cfg.b, fillOpacity: 0.95, radius: 9, weight: 2 };
}
function bindMap() {
  const host = document.getElementById("map-canvas");
  if (!host || typeof L === "undefined") return;
  if (mapInst && mapHost !== host) {
    mapInst.remove();
    mapInst = null;
    mapLayer = null;
  }
  const hasLocation = S.location && Number.isFinite(S.location.lat) && Number.isFinite(S.location.lng);
  const centerLat = hasLocation ? S.location.lat : 0;
  const centerLng = hasLocation ? S.location.lng : 0;
  if (!mapInst) {
    mapInst = L.map(host, { zoomControl: true, attributionControl: true }).setView([centerLat, centerLng], hasLocation ? 14 : 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapInst);
    mapLayer = L.layerGroup().addTo(mapInst);
    mapHost = host;
  }
  mapLayer.clearLayers();
  userMarker = null;
  if (hasLocation) {
    userMarker = L.circleMarker([centerLat, centerLng], { radius: 8, color: "#0E7A55", fillColor: "#0E7A55", fillOpacity: 0.7, weight: 2 }).addTo(mapLayer);
    userMarker.bindPopup("Your current location");
  }
  routeMarker = null;
  const list = DATA.places.filter((p) => p.lat != null && p.lng != null && (S.mf === "all" || p.t === S.mf));
  list.forEach((p) => {
    const color = markerColor(p.t);
    const marker = L.circleMarker([p.lat, p.lng], color).addTo(mapLayer);
    const dir = gmap(p.name, p.lat, p.lng);
    const website = externalUrl(p.website);
    const details = [
      p.address ? `<br>${esc(p.address)}` : "",
      p.phone ? `<br><a href="tel:${encodeURIComponent(p.phone)}">${esc(p.phone)}</a>` : "",
      website ? `<br><a href="${esc(website)}" target="_blank" rel="noopener">Website</a>` : "",
    ].join("");
    marker.bindPopup(`<strong>${esc(p.name || "Unnamed " + (TYPES[p.t] || TYPES.water).n.toLowerCase())}</strong>${p.s ? `<br>${esc(p.s)}` : ""}${details}<br>${Math.round(p.d)} m away<br><a href="${dir}" target="_blank" rel="noopener">Open directions</a>`);
    marker.on("click", () => {
      S.sel = p.id;
      re();
    });
    if (String(S.sel) === String(p.id)) {
      routeMarker = marker;
      marker.openPopup();
      mapInst.setView([p.lat, p.lng], Math.max(13, mapInst.getZoom()));
    }
  });
  if (S.sel) {
    const selected = list.find((p) => String(p.id) === String(S.sel));
    if (selected) {
      mapInst.setView([selected.lat, selected.lng], Math.max(14, mapInst.getZoom()));
    }
  }
  const latLngs = list.map((p) => [p.lat, p.lng]).filter(Boolean);
  if (latLngs.length) {
    const bounds = L.latLngBounds(latLngs);
    if (!S.sel) {
      if (hasLocation) bounds.extend([centerLat, centerLng]);
      mapInst.fitBounds(bounds, { padding: [20, 20] });
    }
  } else if (hasLocation) {
    mapInst.setView([centerLat, centerLng], 14);
  }
  setTimeout(() => mapInst && mapInst.invalidateSize(), 0);
}
