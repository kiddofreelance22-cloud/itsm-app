import { ConflictException } from "@nestjs/common";
import {
  approvalVoteCounts,
  approvalViewerVote,
  assertNoPriorApprovalVote,
  uniqueParallelVoteSlots,
} from "./approval-vote-utils";

describe("approval vote utilities", () => {
  it("returns HTTP 409 with ALREADY_RESPONDED for a second vote", () => {
    try {
      assertNoPriorApprovalVote({ decision: "Approved" });
      fail("Expected the duplicate vote to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      const conflict = error as ConflictException;
      expect(conflict.getStatus()).toBe(409);
      expect(conflict.getResponse()).toMatchObject({ code: "ALREADY_RESPONDED" });
    }
  });

  it("reports the current user's vote and only enables an eligible pending voter", () => {
    const votes = [{
      slot: "u:12",
      decision: "Approved",
      createdAt: new Date("2026-10-30T06:00:00.000Z"),
      user: { userId: 12 },
    }];
    const responded = approvalViewerVote({
      actorId: 12,
      eligibleToAct: false,
      requestPending: true,
      levelStatus: "Pending",
      votes,
    });
    expect(responded).toEqual({
      myVoteStatus: "Approved",
      myVoteAt: votes[0].createdAt,
      canAct: false,
    });

    expect(approvalViewerVote({
      actorId: 13,
      eligibleToAct: true,
      requestPending: true,
      levelStatus: "Pending",
      votes: [],
    })).toEqual({ myVoteStatus: "none", myVoteAt: null, canAct: true });

    expect(approvalViewerVote({
      actorId: 12,
      eligibleToAct: false,
      requestPending: true,
      levelStatus: "Pending",
      votes: [{ ...votes[0], decision: "Rejected" }],
    })).toMatchObject({ myVoteStatus: "Rejected", canAct: false });

    expect(approvalViewerVote({
      actorId: 13,
      eligibleToAct: false,
      requestPending: true,
      levelStatus: "Pending",
      votes: [],
    })).toMatchObject({ myVoteStatus: "none", canAct: false });

    expect(approvalViewerVote({
      actorId: 12,
      eligibleToAct: false,
      requestPending: false,
      levelStatus: "Info requested",
      votes: [],
      actedById: 12,
      actedAt: votes[0].createdAt,
    })).toEqual({
      myVoteStatus: "Info requested",
      myVoteAt: votes[0].createdAt,
      canAct: false,
    });
  });

  it("creates and counts one vote slot for a user named directly and in a group", () => {
    const user = { userId: 12 };
    const slots = uniqueParallelVoteSlots([
      { slot: "e:0", users: [user] },
      { slot: "e:1", users: [user, { userId: 13 }] },
    ]);

    expect(slots).toEqual([
      { slot: "u:12", users: [user] },
      { slot: "u:13", users: [{ userId: 13 }] },
    ]);
    expect(approvalVoteCounts(slots, [
      { slot: "u:12", decision: "Approved", user },
      { slot: "u:13", decision: "Approved", user: { userId: 13 } },
      { slot: "e:1", decision: "Approved", user },
    ])).toEqual({ approved: 2, rejected: 0 });
  });
});
