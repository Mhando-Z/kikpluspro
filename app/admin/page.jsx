import { LockKeyhole, Settings2 } from "lucide-react";
import { PageIntro } from "@/components/football/FootballUI";
import { SyncConsole } from "@/components/football/SyncConsole";

export const metadata = { title: "Sync control" };

export default function AdminPage() {
  return <div className="space-y-7"><PageIntro eyebrow="Operations" title="Control freshness without surrendering the quota." description="Trigger one allowlisted endpoint, process scheduled jobs and inspect recent worker health. Every mutation requires your server-only admin key." actions={<><span className="chip"><LockKeyhole className="size-3" /> Protected route</span><span className="chip"><Settings2 className="size-3" /> Rate-aware</span></>} /><SyncConsole /></div>;
}

