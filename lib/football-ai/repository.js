import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AI_MODEL_KEY, FOOTBALL_DATA_LEAGUES, modelFamilyForKey } from "@/lib/football-ai/constants";
import { modelSummary } from "@/lib/football-ai/model";

const MODEL_SELECT = "id,model_key,version,algorithm,feature_version,trained_from,trained_to,training_rows,validation_rows,test_rows,metrics,artifact,trained_at";

export async function getActiveModelRecord(modelKey = AI_MODEL_KEY) {
  const supabase = createServerSupabaseClient({ serviceRole: true });
  if (!supabase) return { record: null, error: "Supabase server credentials are not configured." };
  const { data, error } = await supabase
    .from("ai_model_versions")
    .select(MODEL_SELECT)
    .eq("model_key", modelKey)
    .eq("is_active", true)
    .eq("status", "ready")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { record: data ?? null, error: error?.message ?? null };
}

export async function getActiveModelRecords() {
  const supabase = createServerSupabaseClient({ serviceRole: true });
  if (!supabase) return { records: [], error: "Supabase server credentials are not configured." };
  const { data, error } = await supabase.from("ai_model_versions")
    .select(MODEL_SELECT)
    .eq("is_active", true)
    .eq("status", "ready")
    .order("model_key", { ascending: true });
  return { records: data ?? [], error: error?.message ?? null };
}

export function safeModelIdentity(record) {
  if (!record) return null;
  const family = modelFamilyForKey(record.model_key);
  return {
    id: record.id,
    modelKey: record.model_key,
    family: family.label,
    shortFamily: family.shortLabel,
    version: record.version,
    algorithm: record.algorithm,
    trainedTo: record.trained_to,
    trainingRows: record.training_rows,
    validationRows: record.validation_rows,
    testRows: record.test_rows,
    testMetrics: record.metrics?.test ?? null,
  };
}

function leagueTeams(artifact, league, resolveTeamAsset) {
  const countryMarker = `:${league.countryCode}:`;
  return Object.values(artifact.teams ?? {})
    .filter((team) => team.key.includes(countryMarker))
    .filter((team) => !artifact.latestSeasonStart || !team.lastSeasonStart || team.lastSeasonStart === artifact.latestSeasonStart)
    .map((team) => {
      const asset = resolveTeamAsset?.({ canonicalKey: team.key, name: team.name, countryCode: league.countryCode });
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
