import { CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Incident } from "@/types/incident";

export function SLAInfoCard({ sla }: { sla: Incident["sla"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>SLA Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Response Time</p>
            <p className="mt-1 text-sm text-slate-700">Target: {sla.responseTarget}</p>
            {sla.responseMet && (
              <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-green-600">
                <CheckCircle2 className="size-3.5" /> Met
              </span>
            )}
            {sla.respondedIn && (
              <p className="mt-1 text-xs text-slate-400">Responded in {sla.respondedIn}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Resolution Time</p>
            <p className="mt-1 text-sm text-slate-700">Target: {sla.resolutionTarget}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <Progress value={sla.percentElapsed} className="flex-1" />
              <span className="shrink-0 text-xs font-medium text-slate-500">{sla.percentElapsed}%</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Time Elapsed: {sla.timeElapsed}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">SLA Status</p>
            <div className="mt-1.5">
              <Badge variant={sla.status === "Within SLA" ? "green" : sla.status === "At Risk" ? "amber" : "red"}>
                {sla.status}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
