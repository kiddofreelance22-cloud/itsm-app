import { evaluateApprovalRule } from "./approval-rule";

describe("approval rule decisions", () => {
  describe.each([1, 2, 10])("for a group of %i members", (total) => {
    it("uses the first decision for any-one", () => {
      expect(evaluateApprovalRule("any", 1, 0, total)).toBe("approved");
      expect(evaluateApprovalRule("any", 0, 1, total)).toBe("rejected");
    });

    it("passes majority above 50% and fails only when it is unreachable", () => {
      const required = Math.floor(total / 2) + 1;
      expect(evaluateApprovalRule("majority", required, 0, total)).toBe("approved");
      expect(evaluateApprovalRule("majority", required - 1, total - required, total)).toBe("pending");
      expect(evaluateApprovalRule("majority", required - 1, total - required + 1, total)).toBe("rejected");
    });

    it("requires every member to approve", () => {
      expect(evaluateApprovalRule("all", total - 1, 0, total)).toBe("pending");
      expect(evaluateApprovalRule("all", total - 1, 1, total)).toBe("rejected");
      expect(evaluateApprovalRule("all", total, 0, total)).toBe("approved");
    });
  });

  it("applies the single-person approval rule to one selected user", () => {
    expect(evaluateApprovalRule("any", 0, 0, 1)).toBe("pending");
    expect(evaluateApprovalRule("any", 1, 0, 1)).toBe("approved");
    expect(evaluateApprovalRule("any", 0, 1, 1)).toBe("rejected");
  });

  it("rejects a level that has no eligible approvers", () => {
    expect(evaluateApprovalRule("majority", 0, 0, 0)).toBe("rejected");
  });
});
