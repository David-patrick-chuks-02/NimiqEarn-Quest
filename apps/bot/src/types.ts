export interface SessionData {
  /** Set once the worker has completed onboarding. */
  onboardingComplete?: boolean;
  /** Quest id the creator is about to edit (handed to the editQuest conversation). */
  editQuestId?: string;
  /** Set once the one-time pinned security/anti-scam notice has been shown. */
  securityNoticeShown?: boolean;
  /** Set once the user has solved the human-verification CAPTCHA. */
  captchaVerified?: boolean;
  /** The pending CAPTCHA challenge: expected answer, its message id, and any /start payload. */
  captcha?: { answer: string; messageId: number; startPayload?: string };
  /** Which secure-action-password flow to run when the securityPassword conversation starts. */
  securityIntent?: "set" | "change" | "remove";
}
