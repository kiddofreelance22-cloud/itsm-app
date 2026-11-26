import { ConflictException } from "@nestjs/common";

export type ApprovalVoteStatus = "none" | "Approved" | "Rejected" | "Info requested";

export interface ApprovalVoteLike {
  slot: string;
  decision: string;
  createdAt?: Date;
  user?: { userId: number } | null;
}

export interface ApprovalVoteSlot<UserLike extends { userId: number } = { userId: number }> {
  slot: string;
  users: UserLike[];
}

export function canActOnPendingApproval(
  eligible: boolean,
  slotAvailable: boolean,
  hasResponded: boolean,
): boolean {
  return eligible && slotAvailable && !hasResponded;
}

export function uniqueParallelVoteSlots<UserLike extends { userId: number }>(
  slots: ApprovalVoteSlot<UserLike>[],
): ApprovalVoteSlot<UserLike>[] {
  const seen = new Set<number>();
  return slots.flatMap((slot) => {
    const users = slot.users.filter((user) => {
      if (seen.has(user.userId)) return false;
      seen.add(user.userId);
      return true;
    });
    return users.map((user) => ({ slot: `u:${user.userId}`, users: [user] }));
  });
}

export function approvalVoteCounts(
  slots: ApprovalVoteSlot[],
  votes: ApprovalVoteLike[],
): { approved: number; rejected: number } {
  const counts = { approved: 0, rejected: 0 };
  const countedSlots = new Set<string>();
  const countedUsers = new Set<number>();
  const decisions = votes.filter(
    (vote) =>
      (vote.decision === "Approved" || vote.decision === "Rejected") &&
      vote.user != null,
  );

  const count = (slot: ApprovalVoteSlot, vote: ApprovalVoteLike) => {
    const userId = vote.user!.userId;
    if (countedSlots.has(slot.slot) || countedUsers.has(userId)) return;
    countedSlots.add(slot.slot);
    countedUsers.add(userId);
    if (vote.decision === "Approved") counts.approved++;
    else counts.rejected++;
  };

  for (const slot of slots) {
    const vote = decisions.find(
      (candidate) =>
        candidate.slot === slot.slot &&
        slot.users.some((user) => user.userId === candidate.user!.userId),
    );
    if (vote) count(slot, vote);
  }

  for (const vote of decisions) {
    const userId = vote.user!.userId;
    if (countedUsers.has(userId)) continue;
    const slot = slots.find((candidate) =>
      candidate.users.some((user) => user.userId === userId),
    );
    if (slot) count(slot, vote);
  }

  return counts;
}

export function approvalViewerVote(input: {
  actorId: number;
  eligibleToAct: boolean;
  requestPending: boolean;
  levelStatus: string;
  votes: ApprovalVoteLike[];
  actedById?: number | null;
  actedAt?: Date | null;
}): {
  myVoteStatus: ApprovalVoteStatus;
  myVoteAt: Date | null;
  canAct: boolean;
} {
  const vote = input.votes.find(
    (candidate) =>
      candidate.user?.userId === input.actorId &&
      (candidate.decision === "Approved" || candidate.decision === "Rejected"),
  );
  const actedByMe = !vote && input.actedById === input.actorId;
  const myVoteStatus: ApprovalVoteStatus = vote
    ? (vote.decision as "Approved" | "Rejected")
    : actedByMe &&
        (input.levelStatus === "Approved" ||
          input.levelStatus === "Rejected" ||
          input.levelStatus === "Info requested")
      ? input.levelStatus
      : "none";

  return {
    myVoteStatus,
    myVoteAt: vote?.createdAt ?? (actedByMe ? input.actedAt ?? null : null),
    canAct:
      input.requestPending &&
      input.levelStatus === "Pending" &&
      input.eligibleToAct &&
      myVoteStatus === "none",
  };
}

export function assertNoPriorApprovalVote(
  vote: Pick<ApprovalVoteLike, "decision"> | null | undefined,
): void {
  if (vote?.decision === "Approved" || vote?.decision === "Rejected") {
    throw new ConflictException({
      code: "ALREADY_RESPONDED",
      message: "You have already responded to this approval",
    });
  }
}

export function alreadyRespondedConflict(): ConflictException {
  return new ConflictException({
    code: "ALREADY_RESPONDED",
    message: "You have already responded to this approval",
  });
}
