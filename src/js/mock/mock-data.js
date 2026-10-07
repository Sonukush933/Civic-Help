/* DEMO DATA ONLY. Used when API_MODE = "mock", and as a clearly-labelled bundled
   fallback. Records are shaped like the future backend responses (see api.js). */
window.CH_MOCK = {
  facilities: [
    { id: 1, category: "water", name: "Drinking water point", distance_m: 350, status_label: "Available", map: { x: 120, y: 115 } },
    { id: 2, category: "water", name: "Water refill station", distance_m: 620, status_label: "Available", map: { x: 60, y: 250 } },
    { id: 3, category: "toilet", name: "Public toilets", distance_m: 250, status_label: "Accessible", map: { x: 225, y: 120 } },
    { id: 4, category: "toilet", name: "Accessible toilets", distance_m: 540, status_label: "Accessible", map: { x: 200, y: 255 } },
    { id: 5, category: "hospital", name: "City hospital", distance_m: 800, status_label: "Open", map: { x: 285, y: 205 } },
    { id: 6, category: "hospital", name: "Community health centre", distance_m: 1100, status_label: "Open", map: { x: 30, y: 40 } },
    { id: 7, category: "pharmacy", name: "Pharmacy", distance_m: 400, status_label: "Open now", map: { x: 60, y: 95 } },
    { id: 8, category: "pharmacy", name: "24-hour chemist", distance_m: 700, status_label: "Open now", map: { x: 250, y: 262 } },
    { id: 9, category: "charging", name: "Public charging point", distance_m: 500, status_label: "Public charging", map: { x: 150, y: 200 } },
    { id: 10, category: "food", name: "Food stalls", distance_m: 300, status_label: "Open", map: { x: 225, y: 45 } },
    { id: 11, category: "food", name: "Community kitchen", distance_m: 480, status_label: "Open", map: { x: 105, y: 268 } },
    { id: 12, category: "legal", name: "Legal aid desk", distance_m: 600, status_label: "Open until 8 PM", map: { x: 40, y: 190 } },
  ],
  updates: [
    { id: 1, status: "verified", title: "Traffic restriction reported", body: "Traffic movement is restricted near Mahapalika Marg. Use southern exit.", source: { name: "Mumbai Traffic Police", url: null }, display: { time: "2:30 PM", ago: "12 min ago" }, verification_reason: "Published on the official traffic police channel. Source and time are shown on every update." },
    { id: 2, status: "verified", title: "Public gathering location update", body: "Updated entry and exit information for the gathering area. Follow volunteer guidance.", source: { name: "Official source", url: null }, display: { time: "1:50 PM", ago: "52 min ago" }, verification_reason: "Matches an official announcement from the organising authority." },
    { id: 3, status: "verified", title: "Extra drinking water points added", body: "Additional water points have been set up near the east gate.", source: { name: "Municipal Corporation", url: null }, display: { time: "1:15 PM", ago: "1 hr ago" }, verification_reason: "Confirmed by a civic body notice and cross-checked on the map." },
    { id: 4, status: "unverified", title: "Crowding reported near the station", body: "Heavy crowding is being reported. No official confirmation yet. Avoid sharing until verified.", source: { name: "Public report · pending check", url: null }, display: { time: "12:40 PM", ago: "2 hr ago" }, verification_reason: "Only one unofficial source so far. We will update when an official source confirms or denies it." },
    { id: 5, status: "disputed", title: "Claim: all metro stations closed", body: "This claim is incorrect. Services are running as per the operator.", source: { name: "Metro operator notice", url: null }, display: { time: "12:10 PM", ago: "2 hr ago" }, verification_reason: "Directly contradicted by the operator\u2019s live service notice." },
  ],
  /* Bundled emergency snapshot. NOT yet verified against an official source (Phase 7). */
  emergency: [
    { number: "112", label: "Emergency response", description: "All emergencies, India-wide", icon: "alert", tone: "t-r" },
    { number: "108", label: "Ambulance / medical", description: "Free emergency ambulance", icon: "hosp", tone: "t-r" },
    { number: "100", label: "Police", description: "Report a crime or danger", icon: "shield", tone: "t-g" },
    { number: "101", label: "Fire", description: "Fire and rescue", icon: "bolt", tone: "t-a" },
    { number: "1091", label: "Women helpline", description: "24-hour support", icon: "user", tone: "t-g" },
    { number: "1098", label: "Childline", description: "Help for children", icon: "user", tone: "t-g" },
    { number: "15100", label: "Legal helpline", description: "National Legal Services Authority", icon: "scale", tone: "t-g" },
  ],
  weather: { temp_c: 29, feels_like_c: 31, condition: "Partly cloudy", rain_probability: 40, updated_label: "Updated 10 min ago" },
  /* Demo-only claim matcher (replaces the old hardcoded checkClaim in the UI). */
  checkClaim: function (q, ctx) {
    var s = String(q).toLowerCase();
    var city = (ctx && ctx.city) || "Mumbai";
    if (/metro|train|local/.test(s) && /clos|stop|shut|suspend/.test(s))
      return { status: "disputed", explanation: "The metro operator\u2019s notice says services are running normally.", sources: [{ name: "Metro operator notice" }], source_label: "Metro operator notice · 12:10 PM" };
    if (/water/.test(s) && /(no|not|without|unavail)/.test(s))
      return { status: "disputed", explanation: "Additional water points were added near the east gate.", sources: [{ name: "Municipal Corporation" }], source_label: "Municipal Corporation · 1:15 PM" };
    if (/traffic|road|exit|gate/.test(s) && /(restrict|block|divert|clos)/.test(s) && !/entire|all|whole/.test(s))
      return { status: "verified", explanation: "An official traffic restriction is in place. Use the southern exit.", sources: [{ name: city + " Traffic Police" }], source_label: city + " Traffic Police · 2:30 PM" };
    return { status: "unverified", explanation: "Currently no matching official announcement found. Please wait for an official source before sharing.", sources: [], source_label: "Checked against official notices just now" };
  },
};
