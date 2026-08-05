export class NotImplementedServiceError extends Error {
  constructor(service: string) {
    super(`${service} is not implemented yet.`);
    this.name = "NotImplementedServiceError";
  }
}

/** @deprecated Use escrow payouts via quest.service accept/auto-approve. */
export const payoutService = {
  async createPayout() {
    throw new NotImplementedServiceError("payout_service");
  },
};

/** @deprecated Submissions are created via quest.service.submitQuest. */
export const submissionService = {
  async createSubmission() {
    throw new NotImplementedServiceError("submission_service");
  },
};

/** @deprecated Use createVerificationService from verification.service.ts. */
export const verificationService = {
  async verifySubmission() {
    throw new NotImplementedServiceError("verification_service");
  },
};
