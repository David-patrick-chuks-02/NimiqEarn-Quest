export class NotImplementedServiceError extends Error {
  constructor(service: string) {
    super(`${service} is not implemented yet.`);
    this.name = "NotImplementedServiceError";
  }
}

export const payoutService = {
  async createPayout() {
    throw new NotImplementedServiceError("payout_service");
  },
};

export const submissionService = {
  async createSubmission() {
    throw new NotImplementedServiceError("submission_service");
  },
};

export const verificationService = {
  async verifySubmission() {
    throw new NotImplementedServiceError("verification_service");
  },
};
