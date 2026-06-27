import { APP_NAME } from "@nimiqearn/shared";

export const messages = {
  errors: {
    noTelegramProfile: "Could not read your Telegram profile. Please try again.",
    apiUnavailable:
      "The server is temporarily unavailable. Please try again in a moment, or tap /help if this keeps happening.",
    profileSaveFailed:
      "Something went wrong while saving your profile. Please try /start again in a moment.",
    generic: "Something went wrong. Please try again or use /help for available commands.",
  },

  help: (botUsername?: string) =>
    [
      `*${APP_NAME} — Help*`,
      "",
      "*Commands*",
      "/start — Create your profile or open the main menu",
      "/menu — Open the main menu",
      "/wallet — Link or update your Nimiq payout address",
      "/creator — Open creator tools or register as a creator",
      "/help — Show this message",
      "",
      "*Main menu*",
      "• *Start Earning* — Your worker status and what's next",
      "• *My Wallet* — Link or update your Nimiq address",
      "• *Help* — Command list and earning guidelines",
      "",
      "*Responsible earning*",
      "Complete tasks honestly and submit genuine proof. Fake or misleading submissions may lead to suspension.",
      "",
      botUsername ? `Bot: @${botUsername}` : "",
      "Questions? Reach out on the Nimiq forum.",
    ]
      .filter(Boolean)
      .join("\n"),

  unknownCommand: "Unknown command. Try /help to see what's available, or /menu to open the main menu.",

  unknownText:
    "I didn't understand that message. Use /menu for navigation or /help for commands.",

  wallet: {
    notRegistered: "You need a worker profile first. Send /start to get started.",
    promptLink:
      "Send your *Nimiq address* (NQ...) to receive quest rewards.\n\nPaste the full address in your next message.",
    promptUpdate:
      "Send a *new Nimiq address* if you want to update your linked wallet.",
    current: (address: string) => `*Linked wallet*\n\`${address}\``,
    linked: (address: string) =>
      `Wallet linked successfully.\n\n\`${address}\`\n\nYou'll receive NIM rewards at this address when quests go live.`,
    invalidAddress: "That doesn't look like a valid Nimiq address. Please send an NQ address and try /wallet again.",
    addressInUse: "This address is already linked to another account. Use a different Nimiq address.",
    linkFailed: "Could not save your wallet right now. Please try /wallet again shortly.",
    timeout: "Wallet linking timed out. Send /wallet when you're ready to try again.",
    alreadyInProgress: "You're already in a wallet flow. Finish that step or wait a moment and try /wallet again.",
  },

  onboarding: {
    welcome: (name: string) =>
      `Welcome to *${APP_NAME}*, ${name}!\n\nEarn NIM by completing quests in the Nimiq ecosystem — product tests, social campaigns, community tasks, and more.`,
    terms:
      "By continuing, you agree to complete tasks honestly and submit genuine proof. Fake submissions may lead to suspension.\n\nTap *I agree* to create your worker profile.",
    termsWrongButton: "Please tap *I agree* to continue, or send /start to begin again.",
    termsTimeout:
      "This setup step timed out. Send /start when you're ready to continue.",
    complete: (displayName: string) =>
      [
        `You're all set, *${displayName}*!`,
        "",
        "Your worker profile is saved.",
        "Use /wallet to link your Nimiq address for rewards.",
        "",
        "Open the menu below to explore.",
      ].join("\n"),
    alreadyInProgress: "You're already setting up your profile. Please continue above, or wait a moment and send /start again.",
  },

  menu: {
    greeting: (name: string) => `Welcome back, *${name}*! Choose an option below.`,
    notRegistered: "You don't have a profile yet. Send /start to get started.",
  },

  creator: {
    notRegistered: "Create a worker profile first with /start, then you can register as a creator.",
    invite: [
      "*Become a quest creator*",
      "",
      "Creators publish paid tasks and bounties for the Nimiq community.",
      "",
      "You'll be able to set rewards, proof rules, and review submissions.",
      "",
      "Tap *Become a Creator* below to upgrade your account.",
    ].join("\n"),
    welcome: "You're now registered as a creator. Use the dashboard below to manage quests.",
    suspended: "Your account is suspended and cannot register as a creator.",
    registerFailed: "Could not register you as a creator right now. Please try /creator again shortly.",
  },

  quest: {
    intro: "Let's draft a new quest. You can publish it later from your creator dashboard.",
    notCreator: "Creator access is required. Send /creator to register first.",
    alreadyInProgress:
      "You're already creating a quest. Finish that flow or wait a moment and try again.",
    promptTitle: "Step 1/7 — Send a *quest title* (3–100 characters).",
    promptCategory: "Step 2/7 — Pick a *category*.",
    promptDescription: "Step 3/7 — Send a *description* (at least 10 characters).",
    promptReward: "Step 4/7 — Send the *reward per slot* in NIM (e.g. `10`).",
    promptSlots: "Step 5/7 — How many *slots* are available? Send a whole number (e.g. `5`).",
    promptDeadline:
      "Step 6/7 — Send a *deadline* as `YYYY-MM-DD` (must be in the future).",
    promptProofType: "Step 7/7 — What *proof type* should workers submit?",
    promptProofInstructions:
      "Almost done — send *proof instructions* (at least 5 characters).",
    invalidTitle: "That title is too short. Send /creator and tap *Create Quest* to try again.",
    invalidDescription:
      "Description must be at least 10 characters. Start over with /creator → *Create Quest*.",
    invalidReward: "Send a positive number for the reward (e.g. `10`).",
    invalidSlots: "Send a positive whole number for slots (e.g. `5`).",
    invalidDeadline: "Send a future date as `YYYY-MM-DD` (e.g. `2026-12-31`).",
    invalidProofInstructions:
      "Proof instructions must be at least 5 characters. Start over with /creator → *Create Quest*.",
    pickCategoryButton: "Please tap one of the category buttons above.",
    pickProofButton: "Please tap one of the proof type buttons above.",
    pickConfirmButton: "Tap *Save Draft* or *Cancel* to continue.",
    cancelled: "Quest draft cancelled. Nothing was saved.",
    saved: (title: string) =>
      `*Draft saved*\n\n"${title}" is stored as a draft. Open *My Quests* to publish it when you're ready.`,
    published: (title: string) =>
      `*Quest published*\n\n"${title}" is now live. Workers will be able to discover it in Milestone 2.`,
    publishFailed: "Could not publish that quest right now. Please try again from *My Quests*.",
    publishNotDraft: "That quest is no longer a draft and cannot be published again.",
    publishNotFound: "Quest not found. Refresh *My Quests* and try again.",
    publishDeadlinePassed: "This quest's deadline has passed. Create a new draft with a future date.",
    saveFailed: "Could not save your quest right now. Please try again from /creator.",
    invalidQuest: "Some quest details were invalid. Please start over with /creator → *Create Quest*.",
    timeout: "Quest creation timed out. Send /creator and tap *Create Quest* when you're ready.",
    listFailed: "Could not load your quests right now. Please try again shortly.",
  },
};
