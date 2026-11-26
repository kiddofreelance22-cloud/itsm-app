import type { Repository } from "typeorm";
import { Catalog } from "../catalogs/entities/catalog.entity";
import { Role } from "../roles/entities/role.entity";
import { AssignmentGroup } from "../assignment-group/entities/assignment-group.entity";
import { ApprovalLevel } from "./entities/approval-level.entity";
import { Workflow } from "./entities/workflow.entity";
import { WorkflowStep } from "./entities/workflow-step.entity";
import { WorkflowTask } from "./entities/workflow-task.entity";
import { WorkflowTransition } from "./entities/workflow-transition.entity";
import { KnowledgeArticle } from "../knowledge/entities/knowledge-article.entity";
import { WorkflowsService, workflowConditionValues } from "./workflows.service";

describe("workflow condition routing", () => {
  const condition = {
    workflowStepId: 10,
    stepOrder: 1,
    stepType: "condition",
    conditionExpression: "Estimated cost is greater than $1,000",
  } as WorkflowStep;
  const approval = {
    workflowStepId: 11,
    stepOrder: 2,
    stepType: "approval",
  } as WorkflowStep;
  const transitions = [
    { fromStep: condition, branch: "yes", toStep: null },
    { fromStep: condition, branch: "no", toStep: approval },
  ] as WorkflowTransition[];

  const service = (workflowsRepo = {} as Repository<Workflow>) => new WorkflowsService(
    workflowsRepo,
    { find: jest.fn().mockResolvedValue([condition, approval]) } as unknown as Repository<WorkflowStep>,
    { find: jest.fn().mockResolvedValue(transitions) } as unknown as Repository<WorkflowTransition>,
    {} as unknown as Repository<ApprovalLevel>,
    {} as unknown as Repository<Role>,
    {} as unknown as Repository<AssignmentGroup>,
    {} as unknown as Repository<WorkflowTask>,
    {} as unknown as Repository<Catalog>,
    {} as unknown as Repository<KnowledgeArticle>,
  );

  it("finishes the lifecycle when catalog estimated cost is above the threshold", async () => {
    const values = workflowConditionValues([], 1200);

    await expect(service().getFirstStep(1, values)).resolves.toBeNull();
  });

  it("continues to the next approval when catalog estimated cost is below the threshold", async () => {
    const values = workflowConditionValues([], 800);

    await expect(service().getFirstStep(1, values)).resolves.toBe(approval);
  });

  it("uses a submitted Estimated cost answer instead of the catalog default", () => {
    expect(workflowConditionValues([{ label: "Estimated cost", value: "700" }], 1200))
      .toEqual([{ label: "Estimated cost", value: "700" }]);
  });

  it("lists workflows only from the requested lifecycle scope", async () => {
    const find = jest.fn().mockResolvedValue([]);
    await service({ find } as unknown as Repository<Workflow>).findAll("knowledge");

    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { workflowScope: "knowledge" } }));
  });
});
