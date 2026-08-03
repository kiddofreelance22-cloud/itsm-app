import { AlertCircle, GitBranch } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function RelatedItemsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Items</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          No related Problems
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <GitBranch className="size-4 shrink-0" aria-hidden="true" />
          No related Changes
        </div>
      </CardContent>
    </Card>
  );
}
