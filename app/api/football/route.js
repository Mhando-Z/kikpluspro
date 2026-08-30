import { NextResponse } from "next/server";
import { getFootballData } from "@/lib/api-football/cache";
import { getEndpointDefinition } from "@/lib/api-football/endpoints";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const endpointId = url.searchParams.get("endpoint");
  const definition = getEndpointDefinition(endpointId);

  if (!definition || definition.id === "status") {
    return NextResponse.json(
      { error: "Unknown or restricted endpoint." },
      { status: 400 },
    );
  }

  const params = Object.fromEntries(
    definition.params
      .filter((key) => url.searchParams.has(key))
      .map((key) => [key, url.searchParams.get(key)]),
  );

  const missing = definition.required.filter((key) => !params[key]);
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required parameters: ${missing.join(", ")}` },
      { status: 422 },
    );
  }

  try {
    const result = await getFootballData(definition.id, params, {
      allowStale: true,
    });
    return NextResponse.json(result, {
      headers: {
        "cache-control": "public, s-maxage=15, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load data." },
      { status: 500 },
    );
  }
}

