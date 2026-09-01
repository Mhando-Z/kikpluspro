const BASE_URL = "https://www.livexscores.com/free2.php";

export const LIVE_SCORE_VIEWS = Object.freeze({
  all: { label: "All matches", page: 0 },
  live: { label: "In play", page: 4 },
  upcoming: { label: "Not started", page: 2 },
  finished: { label: "Finished", page: 3 },
});

const styles = {
  light: [
    "xffffff", "087554", "101a17", "61716b", "ef476f", "dce6e2", "101a17", "e9efed",
    "ef476f", "verdana", "11", "f4f7f6", "ffffff", "bdc9c4", "650", "ef476f",
  ],
  dark: [
    "07110e", "31dfa4", "f1f8f5", "8ea49c", "ff7393", "1a3028", "f1f8f5", "0c1814",
    "ff7393", "verdana", "11", "12231d", "0c1814", "2a443a", "650", "ff7393",
  ],
};

function widgetStyle(theme) {
  const values = styles[theme] ?? styles.dark;
  return values.map((value, index) => {
    if (index === 9 || index === 10 || index === 14) return value;
    return `x${value}`;
  }).join(",");
}

export function buildLiveScoreWidgetUrl({ view = "all", theme = "dark" } = {}) {
  const selectedView = LIVE_SCORE_VIEWS[view] ?? LIVE_SCORE_VIEWS.all;
  return `${BASE_URL}?p=${selectedView.page}&sport=football&style=${widgetStyle(theme)}&timezone=+0`;
}

