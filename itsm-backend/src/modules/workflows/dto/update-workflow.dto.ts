import { PartialType, OmitType } from "@nestjs/swagger";
import { CreateWorkflowDto } from "./create-workflow.dto";

// Steps are managed separately via the workflow-steps sub-resource once the workflow exists
export class UpdateWorkflowDto extends PartialType(
  OmitType(CreateWorkflowDto, ["steps"] as const)
) {}
