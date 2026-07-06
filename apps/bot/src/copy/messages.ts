import { APP_NAME } from "@nimiqearn/shared";
import { escapeMarkdown } from "../utils/markdown.js";

function section(title: string, body: string) {
  return [`*${title}*`, "", body].join("\n");
}

/** Markdown links to the public Terms and Privacy pages (read at call time so env is loaded). */
function legalLinks() {
  const base = (process.env.WEB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `[Terms of Service](${base}/terms) · [Privacy Policy](${base}/privacy)`;
}

export function questStep(step: number, total: number, title: string, instruction: string) {
  return section(`Step ${step} of ${total} · ${title}`, instruction);
}

export const messages = {
  errors: {
    noTelegramProfile:
      "We could not read your Telegram profile. Please try again in a moment.",
    apiUnavailable:
      "Our servers are temporarily unavailable. Please wait a moment and try again, or send /help for assistance.",
    profileSaveFailed:
      "Your profile could not be saved. Please send /start to try again.",
    generic:
      "Something went wrong. Please try again, or send /help for available commands.",
    rateLimited:
      "You're doing that a bit too fast. Please wait a moment and try again.",
    useButtons: "Please use the buttons above to continue, or tap Cancel.",
  },

  help: (botUsername?: string) =>
    [
      section(`${APP_NAME}`, "Earn NIM by completing quests in the Nimiq ecosystem."),
      "",
      section(
        "Commands",
        [
          "/start — Create your profile or open the main menu",
          "/menu — Open the main menu",
          "/wallet — Link or update your Nimiq payout address",
          "/quests — Browse quests (worker discovery in Milestone 2)",
          "/creator — Open the Creator Hub",
          "/help — View this guide",
        ].join("\n"),
      ),
      "",
      section(
        "Main menu",
        [
          "• *Start Earning* — View your worker profile and verification status",
          "• *My Wallet* — Link or update your Nimiq address",
          "• *Creator Hub* — Create and manage paid quests",
          "• *Help* — Commands and community guidelines",
        ].join("\n"),
      ),
      "",
      section(
        "Community guidelines",
        "Complete tasks honestly and submit genuine proof. Misleading or fraudulent submissions may result in account suspension.",
      ),
      "",
      section("Legal", legalLinks()),
      "",
      botUsername ? `_Bot:_ @${botUsername}` : "",
      "For support, visit the Nimiq community forum.",
    ]
      .filter(Boolean)
      .join("\n"),

  unknownCommand:
    "That command is not recognized. Send /help for available commands, or /menu to open the main menu.",

  unknownText:
    "Please use the menu buttons below, send /menu to navigate, or /help for commands.",

  flow: {
    cancelled: "This action was cancelled. You can continue from the main menu.",
  },

  wallet: {
    notRegistered:
      "A worker profile is required before linking a wallet. Please send /start to register.",
    promptLink: section(
      "Link your Nimiq wallet",
      [
        "Send your Nimiq payout address (starts with `NQ`).",
        "",
        "You'll then prove you own it by signing a quick message — no transaction, no fees.",
        "",
        "Paste the full address in chat, or tap *Cancel* to return.",
      ].join("\n"),
    ),
    verifyInstructions: () =>
      section(
        "Link your wallet",
        [
          "Sign a short message to prove you own your wallet — it moves no funds.",
          "",
          "1. Tap *🔗 Sign with Nimiq* below.",
          "2. Approve the signature in your wallet.",
          "",
          "You'll get a confirmation here automatically once it's connected — no need to come back and tap anything.",
          "",
          "💡 Best experience: tap *📋 Copy link* and open it in *Nimiq Pay* (Mini Apps) to sign right in your wallet. No Nimiq Pay? *🔗 Sign with Nimiq* works in any browser.",
        ].join("\n"),
      ),
    verifyInstructionsLink: (url: string) =>
      section(
        "Link your wallet",
        [
          "Sign a short message to prove you own your wallet — it moves no funds.",
          "",
          "1. Open this link:",
          `\`${url}\``,
          "2. Approve the signature in your wallet.",
          "",
          "You'll get a confirmation here automatically once it's connected.",
          "",
          "💡 Best experience: open it in *Nimiq Pay* (Mini Apps). It also works in any browser.",
        ].join("\n"),
      ),
    notVerifiedYet:
      "We haven't received your signed proof yet. Finish signing, then tap I've signed again.",
    verificationExpired:
      "This verification link expired. Please send /wallet to start again.",
    challengeFailed:
      "We could not start wallet verification. Please send /wallet to try again.",
    promptUpdate: section(
      "Update wallet address",
      [
        "Send the new Nimiq address you would like to use for payouts.",
        "",
        "Paste the full address in chat, or tap *Cancel* to return.",
      ].join("\n"),
    ),
    current: (address: string) =>
      section("Current wallet", `\`${address}\``),
    linked: (address: string) =>
      [
        section("Wallet linked", "Your profile is now verified and your account is active."),
        "",
        `*Payout address*\n\`${address}\``,
        "",
        "You will receive NIM rewards at this address when eligible quests are completed.",
      ].join("\n"),
    invalidAddress:
      "The address provided is not a valid Nimiq address. Please send an address starting with `NQ`, or send /wallet to try again.",
    addressInUse:
      "This Nimiq address is already linked to another account. Please use a different address.",
    alreadyLinked:
      "This wallet is already linked to your account. Open *My Wallets* to manage it.",
    linkFailed:
      "We could not save your wallet at this time. Please send /wallet to try again.",
    timeout:
      "Wallet linking timed out. Send /wallet when you are ready to continue.",
    alreadyInProgress:
      "A wallet flow is already in progress. Please complete or cancel it before starting again.",
    cancelled: "Wallet linking was cancelled.",
  },

  onboarding: {
    welcome: (name: string) =>
      [
        section(`Welcome to ${APP_NAME}`, `Good to meet you, *${escapeMarkdown(name)}*.`),
        "",
        "NimiqEarn Quest connects workers and creators inside Telegram. Complete quests, submit proof, and earn NIM rewards.",
        "",
        "To get started, review the terms below and create your worker profile.",
      ].join("\n"),
    terms: () =>
      section(
        "Terms of participation",
        [
          "By continuing, you agree to:",
          "• Complete tasks honestly",
          "• Submit genuine proof of work",
          "• Follow community and platform guidelines",
          "",
          "Accounts that submit misleading or fraudulent proof may be suspended.",
          "",
          `Read the full ${legalLinks()}.`,
          "",
          "Tap *I agree* to create your worker profile.",
        ].join("\n"),
      ),
    termsWrongButton:
      "Please tap *I agree* to continue, or send /start to begin again.",
    termsWrongButtonToast: "Select I agree to continue.",
    termsTimeout:
      "Setup timed out. Send /start when you are ready to continue.",
    complete: (displayName: string) =>
      [
        section("Profile created", `Welcome aboard, *${escapeMarkdown(displayName)}*.`),
        "",
        "Your worker profile has been saved.",
        "",
        "*Next step:* link your Nimiq wallet with /wallet to verify your account.",
        "",
        "Use the menu below to continue.",
      ].join("\n"),
    alreadyInProgress:
      "Profile setup is already in progress. Please complete the steps above, or wait a moment and send /start again.",
  },

  quests: {
    comingSoon: section(
      "Quests",
      [
        "Quest discovery for workers is coming in Milestone 2.",
        "",
        "Soon you'll browse open quests, join them, and submit proof to earn NIM.",
        "",
        "For now, link your wallet with /wallet so you're ready when quests go live.",
      ].join("\n"),
    ),
    creatorHint: section(
      "Quests",
      [
        "Worker quest discovery launches in Milestone 2.",
        "",
        "As a creator, open *My Quests* from the Creator Hub to manage your own drafts and published quests.",
      ].join("\n"),
    ),
    sharedUnavailable:
      "That quest link is no longer available — it may be a draft, closed, or removed. Use the menu below to get started.",
  },

  walletMenu: {
    header: section(
      "My Wallets",
      [
        "Manage the Nimiq addresses that can receive your NIM payouts.",
        "Your *primary* wallet is where rewards are sent.",
        "",
        "_Each address can be linked to only one account._",
      ].join("\n"),
    ),
    empty: section(
      "My Wallets",
      "You haven't linked a Nimiq wallet yet. Link one to receive NIM payouts.",
    ),
    primarySet: "Primary wallet updated.",
    unlinked: "Wallet unlinked.",
    actionFailed: "That action failed. Please try again.",
  },

  menu: {
    greeting: (name: string) =>
      section("Main menu", `Welcome back, *${escapeMarkdown(name)}*. Select an option below.`),
    notRegistered:
      "No worker profile was found. Please send /start to register.",
    returnPrompt: "Would you like to return to the main menu?",
  },

  creator: {
    notRegistered:
      "Please create a worker profile with /start before accessing the Creator Hub.",
    invite: [
      section("Creator Hub", "Publish paid tasks and bounties for the Nimiq community."),
      "",
      "As a creator, you can:",
      "• Define rewards and participant slots",
      "• Set proof requirements",
      "• Draft and publish quests from Telegram",
      "",
      "Tap *Become a Creator* to upgrade your account.",
    ].join("\n"),
    welcome:
      "Your creator account is active. Use the options below to draft, review, and publish quests.",
    suspended:
      "This account is suspended and cannot access creator features.",
    registerFailed:
      "Creator registration could not be completed. Please try again from /creator.",
    notVerified: section(
      "Verification required",
      [
        "Creator access requires a verified profile.",
        "",
        "Please link your Nimiq wallet with /wallet, then return to the Creator Hub.",
      ].join("\n"),
    ),
    walletRequired: section(
      "Link a wallet first",
      [
        "The Creator Hub needs a linked Nimiq wallet — it's where your payouts and refunds go.",
        "",
        "Paste your Nimiq address (starts with `NQ`) to link it in seconds, then come back.",
      ].join("\n"),
    ),
  },

  quest: {
    intro: section(
      "Create a quest",
      "You will be guided through eight steps. Review the summary before saving your draft.",
    ),
    notCreator: section(
      "Creator access required",
      "Open *Creator Hub* from the main menu, or send /creator to continue.",
    ),
    alreadyInProgress:
      "A quest is already being created. Please finish or cancel the current flow first.",
    promptTitle: questStep(1, 8, "Title", "Send a clear quest title (3–100 characters)."),
    promptCategory: questStep(2, 8, "Category", "Select the category that best describes this quest."),
    promptDescription: questStep(
      3,
      8,
      "Description",
      "Describe the task workers should complete (minimum 10 characters).",
    ),
    promptReward: questStep(
      4,
      8,
      "Reward",
      "Send the reward amount per slot in NIM (example: `10`).",
    ),
    promptSlots: questStep(
      5,
      8,
      "Slots",
      "Send the number of available participant slots (example: `5`).",
    ),
    promptDeadline: questStep(
      6,
      8,
      "Deadline",
      "Send the quest deadline as `YYYY-MM-DD` (must be a future date).",
    ),
    promptProofType: questStep(
      7,
      8,
      "Proof type",
      "Select the type of proof workers must submit.",
    ),
    promptProofInstructions: questStep(
      8,
      8,
      "Proof instructions",
      "Explain exactly what workers should submit (minimum 5 characters).",
    ),
    invalidTitle:
      "The title must be between 3 and 100 characters. Please restart from *Creator Hub* → *Create Quest*.",
    invalidDescription:
      "The description must be at least 10 characters. Please restart from *Creator Hub* → *Create Quest*.",
    invalidReward: "Please send a positive number for the reward (example: `10`).",
    invalidSlots: "Please send a positive whole number for slots (example: `5`).",
    invalidDeadline:
      "Please send a valid future date in `YYYY-MM-DD` format (example: `2026-12-31`).",
    invalidProofInstructions:
      "Proof instructions must be at least 5 characters. Please restart from *Creator Hub* → *Create Quest*.",
    pickCategoryButton: "Please select a category using the buttons above.",
    pickProofButton: "Please select a proof type using the buttons above.",
    pickConfirmButton: "Please choose *Save Draft* or *Cancel* to continue.",
    cancelled: "Quest creation was cancelled. No changes were saved.",
    saved: (title: string) =>
      [
        section("Draft saved", `*${escapeMarkdown(title)}* has been saved as a draft.`),
        "",
        "You may publish it now from *My Quests*, or return to the Creator Hub to create another quest.",
      ].join("\n"),
    published: (title: string) =>
      section("Quest published", `*${escapeMarkdown(title)}* is now live and visible to workers.`),
    publishedToast: "Quest published",
    publishFailed:
      "This quest could not be published. Please try again from *My Quests*.",
    publishNotDraft:
      "Only draft quests can be published. This quest is no longer in draft status.",
    publishNotFound:
      "Quest not found. Please refresh *My Quests* and try again.",
    publishDeadlinePassed:
      "This quest deadline has passed. Please create a new draft with a future date.",
    publishNotFunded:
      "This quest isn't funded yet. Open *🎨 Creator Studio* from the Creator Hub to fund its escrow wallet with the reward pool, then publish from there.",
    saveFailed:
      "The quest draft could not be saved. Please try again from the Creator Hub.",
    invalidQuest:
      "Some quest details were invalid. Please create the quest again from the Creator Hub.",
    timeout:
      "Quest creation timed out. Open the Creator Hub and select *Create Quest* when ready.",
    listFailed:
      "Your quests could not be loaded. Please try again shortly.",
    inputHint:
      "Please type your response in chat, or tap *Cancel* to exit this step.",
    edit: {
      intro: section(
        "Edit draft",
        "Select a field to update. Changes are saved as you go. Tap *Done* when you have finished.",
      ),
      pickField: "Select a field to edit using the buttons above, or tap *Done*.",
      fieldUpdated: "Field updated.",
      updateFailed:
        "That value could not be saved. Please check it and try again.",
      notFound:
        "That draft could not be found. Please refresh *My Quests* and try again.",
      notDraft:
        "Only draft quests can be edited. This quest is no longer a draft.",
      done: (title: string) =>
        section("Draft updated", `*${escapeMarkdown(title)}* has been updated.`),
      cancelled: "Editing cancelled. No further changes were saved.",
      timeout:
        "Editing timed out. Open *My Quests* and select *Edit* when ready.",
    },
  },
};
