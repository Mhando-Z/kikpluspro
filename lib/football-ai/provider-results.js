function canonicalResultKey(row) {
  return [row.league_code, row.match_date, row.home_team_key, row.away_team_key].join("|");
}

function trainingMatchFromFixture(fixture) {
  if (fixture.status !== "finished" || fixture.home_goals === null || fixture.away_goals === null || !fixture.result) {
    return null;
  }
  const providerId = fixture.provider_fixture_id ?? fixture.source_fixture_key;
  return {
    source_match_key: `${fixture.source_key}:${fixture.league_code}:${providerId}`,
    source_key: fixture.source_key,
    provider_match_id: String(providerId),
    league_code: fixture.league_code,
    league_name: fixture.league_name,
    country_code: fixture.country_code,
    season_start: fixture.season_start,
    match_date: fixture.match_date,
    kickoff_time: fixture.kickoff_time,
    home_team_key: fixture.home_team_key,
    away_team_key: fixture.away_team_key,
    home_team_name: fixture.home_team_name,
    away_team_name: fixture.away_team_name,
    home_goals: fixture.home_goals,
    away_goals: fixture.away_goals,
    result: fixture.result,
    competition_stage: fixture.competition_stage ?? null,
    format_era: fixture.format_era ?? null,
    leg: fixture.leg ?? null,
    neutral_venue: Boolean(fixture.neutral_venue),
    source_row_hash: [providerId, fixture.home_goals, fixture.away_goals, fixture.source_last_modified ?? ""].join(":"),
  };
}

async function loadExistingMatches(supabase, matches) {
  if (!matches.length) return [];
  const dates = matches.map((match) => match.match_date).sort();
  const leagues = [...new Set(matches.map((match) => match.league_code))];
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("ai_matches")
      .select("source_match_key,league_code,match_date,home_team_key,away_team_key")
      .in("league_code", leagues)
      .gte("match_date", dates[0])
      .lte("match_date", dates.at(-1))
      .range(offset, offset + 999);
    if (error) throw new Error(`Could not check current result history: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function upsertBatches(supabase, table, rows, onConflict, size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await supabase.from(table).upsert(rows.slice(index, index + size), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export async function archiveFinishedFixtures(supabase, fixtures) {
  const candidates = [...new Map(
    fixtures.map(trainingMatchFromFixture).filter(Boolean)
      .map((match) => [canonicalResultKey(match), match]),
  ).values()];
  const existing = await loadExistingMatches(supabase, candidates);
  const existingByCanonical = new Map(existing.map((match) => [canonicalResultKey(match), match]));
  const existingSourceKeys = new Set(existing.map((match) => match.source_match_key));
  const rows = candidates.filter((match) => (
    existingSourceKeys.has(match.source_match_key) || !existingByCanonical.has(canonicalResultKey(match))
  ));
  await upsertBatches(supabase, "ai_matches", rows, "source_match_key");
  return {
    discovered: candidates.length,
    written: rows.length,
    skippedExisting: candidates.length - rows.length,
  };
}

export async function settleFinishedPredictions(supabase, fixtures) {
  const finishedById = new Map(fixtures
    .filter((fixture) => fixture.id && fixture.status === "finished" && fixture.result)
    .map((fixture) => [fixture.id, fixture]));
  if (!finishedById.size) return { settled: 0 };

  const predictions = [];
  const fixtureIds = [...finishedById.keys()];
  for (let index = 0; index < fixtureIds.length; index += 250) {
    const { data, error } = await supabase.from("ai_predictions")
      .select("id,fixture_id")
      .in("fixture_id", fixtureIds.slice(index, index + 250))
      .is("actual_result", null);
    if (error) throw new Error(`Could not load unsettled predictions: ${error.message}`);
    predictions.push(...(data ?? []));
  }

  const settledAt = new Date().toISOString();
  for (const prediction of predictions) {
    const fixture = finishedById.get(prediction.fixture_id);
    const { error } = await supabase.from("ai_predictions").update({
      actual_result: fixture.result,
      actual_home_goals: fixture.home_goals,
      actual_away_goals: fixture.away_goals,
      settled_at: settledAt,
    }).eq("id", prediction.id);
    if (error) throw new Error(`Could not score prediction ${prediction.id}: ${error.message}`);
  }
  return { settled: predictions.length };
}
