// ─────────────────────────────────────────────────────────────
//  THE CURRENT DROP
//  The NFC card always opens /club. To change what it shows,
//  edit this file only (and put a new image in club/drops/).
//  Any field can be left empty ("") and its block disappears.
// ─────────────────────────────────────────────────────────────

window.DROP = {
  number: "01",                         // shown as "DROP 01"
  kicker: "You are invited",            // top-left line, like the card
  title: "12:11 Show",

  // Start time with Israel's UTC offset (+02:00 in winter, +03:00 in summer)
  start: "2026-11-12T13:00:00+02:00",
  hours: 3,                             // length, for the calendar entry

  place: "Kremenetski 7, Tel Aviv",      // venue name or address
  map: "https://maps.google.com/?q=Kremenetski+7,+Tel+Aviv",                              // Google/Apple Maps link, optional

  image: "drops/12-11-show.jpg",
  imageAlt: "Model in a net dress with metal feathers",

  text: "Members only. Bring the card — it's your entry.",

  // Extra buttons. "calendar" builds an add-to-calendar entry automatically.
  links: [
    { label: "Add to calendar", type: "calendar" },
    { label: "Instagram", href: "https://www.instagram.com/offnaweek/" },
  ],
};
