import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FOOTBALL_DATA_LEAGUES } from "@/lib/football-ai/constants";
import { modelSummary } from "@/lib/football-ai/model";

export async function getActiveModelRecord() {
  const supabase = createServerSupabaseClient({ serviceRole: true });
  if (!supabase) return { record: null, error: "Supabase server credentials are not configured." };
  const { data, error } = await supabase
    .from("ai_model_versions")
    .select("id,model_key,version,algorithm,feature_version,trained_from,trained_to,training_rows,validation_rows,test_rows,metrics,artifact,trained_at")
    .eq("is_active", true)
    .eq("status", "ready")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { record: data ?? null, error: error?.message ?? null };
}

function leagueTeams(artifact, league, resolveTeamAsset) {
  const countryMarker = `:${league.countryCode}:`;
  return Object.values(artifact.teams ?? {})
    .filter((team) => team.key.includes(countryMarker))
    .filter((team) => !artifact.latestSeasonStart || !team.lastSeasonStart || team.lastSeasonStart === artifact.latestSeasonStart)
    .map((team) => {
      const asset = resolveTeamAsset?.({ name: team.name, countryCode: league.countryCode });
      return {
        key: team.key,
        name: team.name,
        elo: Math.round(team.elo * 10) / 10,
        matches: team.matches,
        logo: asset?.logo ?? null,
        apiFootballId: asset?.apiFootballId ?? null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function safeModelPayload(record, resolveTeamAsset = null) {
  if (!record?.artifact) return null;
  const summary = modelSummary(record.artifact);
  return {
    id: record.id,
    modelKey: record.model_key,
    version: record.version,
    algorithm: record.algorithm,
    featureVersion: record.feature_version,
    trainedFrom: record.trained_from,
    trainedTo: record.trained_to,
    trainedAt: record.trained_at,
    trainingRows: record.training_rows,
    validationRows: record.validation_rows,
    testRows: record.test_rows,
    metrics: record.metrics,
    summary: {
      ...summary,
      teamCount: summary.teams.length,
      teams: undefined,
    },
    leagues: Object.values(FOOTBALL_DATA_LEAGUES).map((league) => ({
      code: league.code,
      name: league.name,
      apiFootballId: league.apiFootballId,
      teams: leagueTeams(record.artifact, league, resolveTeamAsset),
    })),
  };
}
