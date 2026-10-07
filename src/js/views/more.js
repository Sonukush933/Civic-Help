const sw = (k, l, d) =>
  `<button class="sw" role="switch" aria-checked="${S[k]}" aria-pressed="${S[k]}" data-act="tog:${k}"><span>${l}${d ? `<br><span class="mut sm" style="font-weight:400">${d}</span>` : ""}</span><i></i></button>`;
function More() {
  return `<div class="rv"><h1 style="font-size:clamp(1.4rem,5vw,1.8rem)">${t("more")}</h1><p class="mut" style="margin-top:4px">Language, accessibility, privacy and app settings.</p></div>
 <div class="two-c eq"><div class="col">
 <section class="card rv"><h2 style="margin-bottom:12px">${t("lang")}</h2><div class="seg" role="group" aria-label="Language">${[
   ["en", "English"],
   ["hi", "\u0939\u093f\u0902\u0926\u0940"],
   ["mr", "\u092e\u0930\u093e\u0920\u0940"],
 ]
   .map(
     (l) =>
       `<button aria-pressed="${S.lang === l[0]}" data-act="lang:${l[0]}">${l[1]}</button>`,
   )
   .join("")}</div></section>
 <section class="card rv"><h2 style="margin-bottom:12px">${ic("a11y")} Accessibility</h2><div class="sec">${sw("big", "Larger text")}${sw("hc", "High contrast")}${sw("rm", "Reduce motion")}</div></section>
 <section class="card rv"><h2 style="margin-bottom:12px">Connection</h2>${sw("weak", "Simulate weak connection", "Preview how the app shows saved essentials")}<p class="mut sm" style="margin-top:10px">Essential numbers and nearby places stay available offline.</p></section></div>
 <div class="col"><section class="card rv"><h2 style="margin-bottom:14px">${t("priv")}</h2><div class="sec" style="gap:14px"><div class="pv"><span class="tile t-g">${ic("lock")}</span><p><b>Location is not published</b><br><span class="mut sm">With permission, coordinates go to CivicHelp and its map, geocoding, and weather providers for nearby results.</span></p></div><div class="pv"><span class="tile t-g">${ic("shield")}</span><p><b>No public user tracking</b><br><span class="mut sm">We don\u2019t publish people\u2019s locations.</span></p></div><div class="pv"><span class="tile t-g">${ic("user")}</span><p><b>No political profiling</b><br><span class="mut sm">This platform does not track political opinions or affiliations.</span></p></div></div><button class="tx" style="margin-top:8px" data-act="sheet:policy">Read privacy policy ${ic("arrow", "s")}</button></section>
 ${S.instDone ? "" : `<div class="inst rv"><span class="tile t-g">${ic("down")}</span><div><b>Install CivicHelp</b><p class="mut sm">Quick access &amp; offline essentials.</p></div><button class="bg" data-act="install">Install</button></div>`}
 <section class="card rv"><h3>About</h3><p class="mut sm" style="margin-top:4px">Neutral public utility. We use your location only on-device to find nearby services and verified civic information.</p></section></div></div>`;
}
