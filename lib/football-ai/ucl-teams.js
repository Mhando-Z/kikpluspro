import { canonicalTeamKey } from "./constants.js";

const ASSOCIATIONS = {
  ENG: "england",
  ESP: "spain",
  ITA: "italy",
  GER: "germany",
  FRA: "france",
  NED: "netherlands",
  POR: "portugal",
  BEL: "belgium",
  AUT: "austria",
  SCO: "scotland",
  SUI: "switzerland",
  TUR: "turkey",
  GRE: "greece",
  DEN: "denmark",
  NOR: "norway",
  SWE: "sweden",
  CZE: "czechia",
  CRO: "croatia",
  SRB: "serbia",
  UKR: "ukraine",
  POL: "poland",
  ROU: "romania",
  HUN: "hungary",
  CYP: "cyprus",
  ISR: "israel",
  KAZ: "kazakhstan",
  AZE: "azerbaijan",
  SVN: "slovenia",
  SVK: "slovakia",
  BUL: "bulgaria",
};

function normalized(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DOMESTIC_ALIASES = new Map();

function aliases(countryCode, canonicalName, values) {
  for (const value of [canonicalName, ...values]) {
    DOMESTIC_ALIASES.set(normalized(value), { countryCode, canonicalName });
  }
}

aliases("england", "Arsenal", ["Arsenal FC"]);
aliases("england", "Aston Villa", ["Aston Villa FC"]);
aliases("england", "Chelsea", ["Chelsea FC"]);
aliases("england", "Liverpool", ["Liverpool FC"]);
aliases("england", "Man City", ["Manchester City", "Manchester City FC"]);
aliases("england", "Man United", ["Manchester United", "Manchester United FC"]);
aliases("england", "Newcastle", ["Newcastle United", "Newcastle United FC"]);
aliases("england", "Tottenham", ["Tottenham Hotspur", "Tottenham Hotspur FC"]);
aliases("england", "Leicester", ["Leicester City", "Leicester City FC"]);

aliases("spain", "Barcelona", ["FC Barcelona"]);
aliases("spain", "Real Madrid", ["Real Madrid CF"]);
aliases("spain", "Ath Madrid", ["Atletico Madrid", "Atletico de Madrid", "Club Atletico de Madrid"]);
aliases("spain", "Ath Bilbao", ["Athletic Club", "Athletic Bilbao"]);
aliases("spain", "Villarreal", ["Villarreal CF"]);
aliases("spain", "Sociedad", ["Real Sociedad", "Real Sociedad de Futbol"]);
aliases("spain", "Sevilla", ["Sevilla FC"]);
aliases("spain", "Girona", ["Girona FC"]);
aliases("spain", "Valencia", ["Valencia CF"]);

aliases("italy", "Inter", ["Internazionale", "Inter Milan", "FC Internazionale Milano"]);
aliases("italy", "Juventus", ["Juventus FC"]);
aliases("italy", "Milan", ["AC Milan"]);
aliases("italy", "Atalanta", ["Atalanta BC"]);
aliases("italy", "Napoli", ["SSC Napoli"]);
aliases("italy", "Roma", ["AS Roma"]);
aliases("italy", "Lazio", ["SS Lazio"]);
aliases("italy", "Fiorentina", ["ACF Fiorentina"]);

aliases("germany", "Bayern Munich", ["Bayern Munchen", "FC Bayern Munchen"]);
aliases("germany", "Dortmund", ["Borussia Dortmund"]);
aliases("germany", "Leverkusen", ["Bayer Leverkusen", "Bayer 04 Leverkusen"]);
aliases("germany", "RB Leipzig", []);
aliases("germany", "Ein Frankfurt", ["Eintracht Frankfurt"]);
aliases("germany", "Stuttgart", ["VfB Stuttgart"]);
aliases("germany", "M'gladbach", ["Borussia Monchengladbach", "Borussia Mgladbach"]);
aliases("germany", "Wolfsburg", ["VfL Wolfsburg"]);

aliases("france", "Paris SG", ["Paris Saint Germain", "Paris Saint-Germain", "Paris Saint-Germain FC"]);
aliases("france", "Marseille", ["Olympique Marseille", "Olympique de Marseille"]);
aliases("france", "Monaco", ["AS Monaco", "AS Monaco FC"]);
aliases("france", "Lille", ["Lille OSC"]);
aliases("france", "Lyon", ["Olympique Lyon", "Olympique Lyonnais"]);
aliases("france", "Brest", ["Stade Brestois", "Stade Brestois 29"]);
aliases("france", "Lens", ["RC Lens"]);
aliases("france", "Rennes", ["Stade Rennais", "Stade Rennais FC"]);

export function associationCountry(code) {
  return ASSOCIATIONS[String(code ?? "").toUpperCase()] ?? String(code ?? "europe").toLowerCase();
}

export function canonicalUclTeam(name, associationCode = null) {
  const cleanName = String(name ?? "").trim();
  const domestic = DOMESTIC_ALIASES.get(normalized(cleanName));
  const countryCode = domestic?.countryCode ?? associationCountry(associationCode);
  const displayName = domestic?.canonicalName ?? cleanName;
  return {
    key: domestic
      ? canonicalTeamKey(countryCode, displayName)
      : canonicalTeamKey(countryCode, cleanName).replace(/^football-data:/, "uefa:"),
    displayName,
    providerName: cleanName,
    countryCode,
    associationCode: associationCode ? String(associationCode).toUpperCase() : null,
  };
}

export function normalizedUclTeamName(name) {
  return normalized(name);
}
