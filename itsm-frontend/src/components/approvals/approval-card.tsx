"use client";
import { Clock, User } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ServiceRequest } from "@/types/request";

interface ApprovalCardProps {
  request: ServiceRequest;
  onApprove: (request: ServiceRequest) => void;
  onReject: (request: ServiceRequest) => void;
}

export function ApprovalCard({ request, onApprove, onReject }: ApprovalCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-3 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {request.catalog.catalogName}
            </p>
            <p className="text-xs text-gray-500 font-mono">#{request.requestId}</p>
          </div>
          {request.currentStep && (
            <span className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5 shrink-0">
              {request.currentStep.stepName}
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {request.requestedBy.fullName}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {new Date(request.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Variable values preview */}
        {request.variableValues.length > 0 && (
          <div className="bg-gray-50 rounded-md p-2.5 space-y-1">
            {request.variableValues.slice(0, 3).map((vv, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-gray-500 shrink-0">{vv.variable.label}:</span>
                <span className="font-medium text-gray-900 truncate">{vv.value}</span>
              </div>
            ))}
            {request.variableValues.length > 3 && (
              <p className="text-xs text-gray-400">
                +{request.variableValues.length - 3} more fields
              </p>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2 pt-0 pb-4">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => onReject(request)}
        >
          Reject
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => onApprove(request)}
        >
          Approve
        </Button>
      </CardFooter>
    </Card>
  );
}
