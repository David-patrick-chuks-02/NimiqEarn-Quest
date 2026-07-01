export interface SessionData {
  /** Set once the worker has completed onboarding. */
  onboardingComplete?: boolean;
  /** Quest id the creator is about to edit (handed to the editQuest conversation). */
  editQuestId?: string;
}
