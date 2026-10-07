function resBox(r) {
  if (!r) return "";
  return `<div class="res" id="res"><div class="row sb">${badge(r.st)}<span class="mut sm">${r.src}</span></div><p>${r.m}</p><div class="row"><button data-act="sheet:sources">View sources</button></div></div>`;
}
function factBox() {
  return `<section class="card fact rv" id="check"><div><h2>${t("susp")}</h2><p class="mut" style="margin-top:2px">Check important claims before sharing them.</p></div><div class="flow"><i></i>PAUSE · CHECK · SHARE</div><div class="claim"><h3>Live source checking is unavailable</h3><div><span class="pill p-u">${ic("alert", "s")}Unverified</span></div><p class="mut">CivicHelp cannot currently confirm or dispute claims. Do not treat a result here as an official verification.</p></div>
 <div class="sec"><input class="inp" id="ci" placeholder="Type or paste a claim" value="${esc(S.claim)}" aria-label="Claim to check" autocomplete="off"><div class="row"><button class="bg" style="flex:1" data-act="claim">Check claim</button><button style="flex:1" data-act="sheet:sources">Verification status</button></div><div id="rbox">${resBox(S.res)}</div></div></section>`;
}
function Upd() {
  const c = (k) =>
    k === "all" ? DATA.updates.length : DATA.updates.filter((u) => u.st === k).length;
  const fl = [
    ["all", "All"],
    ["v", "Verified"],
    ["u", "Unverified"],
    ["x", "Disputed"],
  ];
  const list = DATA.updates.filter((u) => S.uf === "all" || u.st === S.uf);
  return `${dataNotice(["updates"])}<div class="rv"><h1 style="font-size:clamp(1.4rem,5vw,1.8rem)">${t("vupd")}</h1><p class="mut" style="margin-top:4px">Live official-source updates are not configured. No unverified city-wide updates are shown.</p></div>
 <div class="two-c eq"><div class="col"><div class="chips rv" role="group" aria-label="Filter updates">${fl.map((f) => `<button class="fc" aria-pressed="${S.uf === f[0]}" data-act="uf:${f[0]}">${f[1]} ${c(f[0])}</button>`).join("")}</div><div class="sec rv">${list.map((u) => updCard(u)).join("") || '<p class="mut">No live updates are available.</p>'}</div></div>
 <div class="col">${factBox()}<section class="card rv"><h3 style="margin-bottom:8px">Verification limits</h3><p class="mut">The verified, unverified, and disputed labels are meaningful only when supported by current source material. No live source feed is connected right now.</p></section></div></div>`;
}
function bindUpd() {
  S.unread = 0;
  chrome();
  if (S.scroll) {
    const e = document.getElementById(S.scroll);
    e && e.scrollIntoView({ behavior: "smooth", block: "center" });
    S.scroll = null;
  }
}
