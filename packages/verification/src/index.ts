export {
  runRuleEngine,
  appendRuleChecks,
  softCheck,
  hardCheck,
  extractHashtags,
  extractMentions,
  ruleFailOutcome,
  type ProofType,
  type RuleCheck,
  type RuleResult,
} from "./rule-engine.js";

export {
  decide,
  type DecisionInput,
  type DecisionResult,
} from "./decision-engine.js";

export {
  thresholdsFor,
  effectiveReputation,
  type ReputationContext,
} from "./thresholds.js";
