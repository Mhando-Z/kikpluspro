import { createClient } from "@supabase/supabase-js";
import { MODEL_FAMILIES } from "../../lib/football-ai/constants.js";

function argumentsOf(values) {
  return Object.fromEntries(values.map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : true];
  }));
}

async function main() {
  const args = argumentsOf(process.argv.slice(2));
  const modelKey = String(args["model-key"] ?? "");
  if (!MODEL_FAMILIES[modelKey]) {
    throw new Error(`--model-key must be one of: ${Object.keys(MODEL_FAMILIES).join(", ")}`);
  }

  const requestedVersion = args.version === undefined ? null : Number(args.version);
  if (requestedVersion !== null && (!Number.isInteger(requestedVersion) || requestedVersion < 1)) {
    throw new Error("--version must be a positive integer.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let query = supabase.from("ai_model_versions")
    .select("id,model_key,version,algorithm,trained_to,metrics,artifact")
    .eq("model_key", modelKey)
    .eq("status", "ready");
  if (requestedVersion !== null) query = query.eq("version", requestedVersion);
  query = query.order("version", { ascending: false }).limit(1);

  const { data: record, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!record) {
    throw new Error(`No ready ${modelKey} model${requestedVersion === null ? "" : ` at version ${requestedVersion}`} was found.`);
  }

  const expectedScope = [...MODEL_FAMILIES[modelKey].competitionCodes].sort();
  const storedScope = [...(
    record.metrics?.competitionCodes
    ?? Object.keys(record.artifact?.leagues ?? {})
  )].sort();
  if (storedScope.join(",") !== expectedScope.join(",")) {
    throw new Error(`Refusing activation: stored scope [${storedScope.join(", ") || "missing"}] does not match expected scope [${expectedScope.join(", ")}].`);
  }

  const { error: activationError } = await supabase.rpc("activate_ai_model", { target_model_id: record.id });
  if (activationError) throw new Error(`Activation failed: ${activationError.message}`);
  console.log(`Activated ${MODEL_FAMILIES[modelKey].label} v${record.version} (${record.algorithm}), trained through ${record.trained_to}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
