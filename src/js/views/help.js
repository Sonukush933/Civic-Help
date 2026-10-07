function safeCard() {
  return `<section class="card rv"><div class="row" style="flex-wrap:nowrap;margin-bottom:12px"><span class="tile t-g">${ic("shield")}</span><div style="min-width:0"><h2>${t("safe")}</h2><p class="mut sm">Send a simple safety status to someone you trust.</p></div></div><div class="two"><button class="bg okbtn" data-act="safe">${ic("check")}${t("imsafe")}</button><button data-act="sheet:contacts">Trusted contacts${S.contacts.length ? " (" + S.contacts.length + ")" : ""}</button></div><p class="mut sm" style="text-align:center;margin-top:10px">${ic("lock", "s")} Your location is never shared. You choose who gets the message.</p></section>`;
}
function Help() {
  return `${dataNotice(["numbers"])}<div class="rv"><h1 style="font-size:clamp(1.4rem,5vw,1.8rem)">${t("help")}</h1><p class="mut" style="margin-top:4px">Emergency numbers, legal resources and safety check-in.</p></div>
 <div class="two-c eq"><div class="col">
 <section class="card rv"><div class="hd2" style="margin-bottom:4px"><h2>${t("emerg")}</h2><span class="pill p-v">${ic("check", "s")}Official source</span></div><a class="btn br sosb" href="tel:112" style="margin:8px 0 4px">${ic("phone")}${t("call")}</a><div>${DATA.numbers.slice(
   1,
   6,
 )
   .map(
     (n) =>
       `<div class="num"><span class="tile ${n[4]}">${ic(n[3])}</span><div><b class="n">${n[0]}</b><span class="mut sm">${n[1]} · ${n[2]}</span></div><a class="btn" href="tel:${n[0]}" aria-label="Call ${n[1]} ${n[0]}">${ic("phone", "s")}Call</a></div>`,
   )
   .join("")}</div></section>
 ${safeCard()}</div>
 <div class="col"><section class="card rv"><div class="hd2"><div><h2>${t("legal")}</h2><p class="mut">Official resources only \u00b7 No advice on this page</p></div></div><div class="sec"><div class="row" style="flex-wrap:nowrap"><span class="tile t-g">${ic("scale")}</span><div style="flex:1;min-width:0"><h3>Legal aid</h3><p class="mut sm">Find official legal assistance</p></div><button class="bd" data-act="sheet:legal">Get help</button></div><div class="row" style="flex-wrap:nowrap"><span class="tile t-g">${ic("phone")}</span><div style="flex:1;min-width:0"><h3>15100</h3><p class="mut sm">National Legal Services Authority</p></div><a class="btn" href="tel:15100">Call</a></div></div><p class="mut sm" style="margin-top:12px"><span class="pill p-v">${ic("check", "s")}Official resource \u00b7 NALSA</span></p></section>
 <section class="card rv"><h2 style="margin-bottom:4px">Find help nearby</h2><p class="mut sm" style="margin-bottom:12px">Opens the map with that filter.</p><div class="two">${["hospital", "pharmacy", "water", "toilet"].map((k) => `<button data-act="near:${k}"><span style="color:${TYPES[k].c};display:flex">${ic(TYPES[k].i)}</span>${TYPES[k].n}</button>`).join("")}</div></section></div></div>`;
}
