import { Braces, Database } from "lucide-react";
import { PageIntro } from "@/components/football/FootballUI";
import { EndpointExplorer } from "@/components/football/EndpointExplorer";
import { API_FOOTBALL_ENDPOINTS } from "@/lib/api-football/endpoints";

export const metadata = { title: "API explorer" };

export default function ExplorerPage() {
  return <div className="space-y-7"><PageIntro eyebrow="Endpoint laboratory" title="Every API-Football route, safely behind your cache." description="Inspect parameter requirements and cached response shapes without exposing the upstream API key or allowing arbitrary third-party URLs." actions={<><span className="chip"><Braces className="size-3" /> {API_FOOTBALL_ENDPOINTS.length} endpoints</span><span className="chip"><Database className="size-3" /> Allowlisted</span></>} /><EndpointExplorer /></div>;
}

