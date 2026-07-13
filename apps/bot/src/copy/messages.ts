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
    buttonExpired: "This button is no longer active. Send /menu to open a fresh menu.",
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
          "/wallet — Your wallet: balance, deposit & withdraw NIM",
          "/quests — Browse quests (opening soon)",
          "/creator — Open the Creator Hub",
          "/settings — Language and security settings",
          "/help — View this guide",
        ].join("\n"),
      ),
      "",
      section(
        "Main menu",
        [
          "• *Start Earning* — Your worker profile and progress",
          "• *My Wallet* — Balance, deposit & withdraw NIM",
          "• *Creator Hub* — Create and manage paid quests",
          "• *Settings* — Language and security",
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

  captcha: {
    prompt: [
      `*Welcome to ${APP_NAME}*`,
      "",
      "A quick check to keep bots out — type the characters shown above:",
    ].join("\n"),
    incorrect: "That didn't match. Please try the new image above.",
  },

  securityNotice: (botUsername?: string) =>
    [
      "*SECURITY NOTICE — please read*",
      "",
      "*DO NOT CLICK any ads at the top of Telegram.* They are NOT from us and are most likely SCAMS.",
      "",
      'Telegram now shows ads inside bots without our approval. NimiqEarn Quest will *never* advertise airdrops, giveaways, "claim" links, external groups, or fee discounts.',
      "",
      "Our team, moderators and admins will *never* message you first, call you, or ask for your seed phrase or private keys.",
      "",
      botUsername
        ? `Our only official bot is @${escapeMarkdown(botUsername)}. Please don't search Telegram for us — there are many impersonators.`
        : "Please don't search Telegram for our bot — there are many impersonators.",
    ].join("\n"),

  unknownCommand:
    "That command is not recognized. Send /help for available commands, or /menu to open the main menu.",

  unknownText:
    "Please use the menu buttons below, send /menu to navigate, or /help for commands.",

  flow: {
    cancelled: "This action was cancelled. You can continue from the main menu.",
  },

  wallet: {
    noneYet: section(
      "My Wallet",
      "You don't have a wallet yet. Create one now to receive NIM payouts.",
    ),
    custodialView: (address: string, balanceNim: number | null, balanceUsd: number | null) => {
      const lines = [
        section("My Wallet", "This is your NimiqEarn wallet — rewards are paid to this address."),
        "",
        "*Address*",
        `\`${address}\``,
      ];
      if (balanceNim !== null) {
        const usd =
          balanceUsd !== null
            ? ` (~$${balanceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
            : "";
        lines.push("", `*Balance:* ${balanceNim.toLocaleString()} NIM${usd}`);
      }
      lines.push(
        "",
        "Tap *Deposit* to add NIM, or *Withdraw* to send it to another Nimiq address.",
      );
      return lines.join("\n");
    },
    deposit: (address: string) =>
      [
        section("Deposit NIM", "Add funds to your NimiqEarn wallet using the address or QR code below."),
        "",
        "*Your address*",
        `\`${address}\``,
        "",
        "Scan the QR in any Nimiq wallet (or Nimiq Pay), or copy the address above. Funds show up here once the network confirms — tap *Refresh* in *My Wallet* to update your balance.",
      ].join("\n"),
    depositFailed:
      "We couldn't open the deposit panel right now. Please try again in a moment.",
    createFailed:
      "We couldn't set up your wallet right now. Please try again in a moment from /wallet.",
  },

  withdraw: {
    promptAddress: section(
      "Withdraw NIM",
      "Send the Nimiq address you want to withdraw to (starts with `NQ`).\n\nOr tap *Cancel* to go back.",
    ),
    invalidAddress:
      "That doesn't look like a Nimiq address. Send one starting with `NQ`, or tap *Cancel*.",
    promptAmount: section(
      "Withdraw amount",
      "How much NIM would you like to send? Enter an amount (e.g. `5`), or send `all` to withdraw everything.",
    ),
    invalidAmount: "Please enter a positive amount (e.g. `5`), or `all`.",
    confirm: (address: string, amount: number | "all") =>
      [
        "*Confirm withdrawal*",
        "",
        `*Amount:* ${amount === "all" ? "your full balance" : `${amount.toLocaleString()} NIM`}`,
        `*To:* \`${address}\``,
        "",
        "This sends NIM on-chain and *cannot be reversed*. Tap *Confirm* to send.",
      ].join("\n"),
    success: (sentNim: number, address: string, hash: string) =>
      [
        section("Withdrawal sent", `Sent *${sentNim.toLocaleString()} NIM* to:`),
        `\`${address}\``,
        "",
        `*Transaction*\n\`${hash}\``,
        "",
        "It may take a few seconds to confirm on-chain.",
      ].join("\n"),
    timeout: "Withdrawal timed out. Send /wallet when you're ready.",
    cancelled: "Withdrawal cancelled.",
  },

  settings: {
    menu: (passwordSet: boolean) =>
      section(
        "Settings",
        passwordSet
          ? "A secure-action password is set — it's required to confirm withdrawals."
          : "Set a *secure-action password* to protect your funds. Once set, it's required to confirm any withdrawal.",
      ),
    enterNew: section(
      "Set action password",
      "Send a new password (at least 4 characters).\n\nOr tap *Cancel*.",
    ),
    confirmNew: "Send the password again to confirm.",
    enterCurrent: "Send your *current* password.",
    enterCurrentToRemove: "Send your current password to remove it.",
    mismatch: "The passwords didn't match — nothing changed. Open /settings to try again.",
    passwordSet: "Secure-action password saved. It's now required to confirm withdrawals.",
    passwordRemoved: "Secure-action password removed.",
    cancelled: "No changes made.",
    enterToWithdraw: "Enter your secure-action password to confirm this withdrawal:",
    enterToBackup: "Enter your secure-action password to reveal your private key:",
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
        section("You're all set", `Welcome aboard, *${escapeMarkdown(displayName)}*.`),
        "",
        "Your NimiqEarn wallet is ready — rewards are paid straight to it.",
        "",
        "You can back up your wallet's private key anytime in *Settings*.",
        "",
        "Use the menu below to get started.",
      ].join("\n"),
    alreadyInProgress:
      "Profile setup is already in progress. Please complete the steps above, or wait a moment and send /start again.",
  },

  quests: {
    browsePrompt: section(
      "Browse quests",
      "Tap below to open the quest marketplace, complete quests, and earn NIM — paid straight to your wallet.",
    ),
    miniAppOnly:
      "Quests are browsed in the Mini App, which needs the web app on HTTPS. It'll open here once WEB_PUBLIC_URL is set to an https:// address.",
    sharedUnavailable:
      "That quest link is no longer available — it may be a draft, closed, or removed. Use the menu below to get started.",
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
      "Finish setting up first",
      [
        "Creator access needs your wallet ready.",
        "",
        "Open *My Wallet* to finish setting it up, then return to the Creator Hub.",
      ].join("\n"),
    ),
    walletRequired: section(
      "Set up your wallet first",
      [
        "The Creator Hub needs your NimiqEarn wallet — it's where payouts and refunds go.",
        "",
        "Create your wallet below, then come back.",
      ].join("\n"),
    ),
  },

  quest: {
    intro: section(
      "Create a quest",
      "You will be guided through seven steps. Review the summary before saving your draft.",
    ),
    notCreator: section(
      "Creator access required",
      "Open *Creator Hub* from the main menu, or send /creator to continue.",
    ),
    alreadyInProgress:
      "A quest is already being created. Please finish or cancel the current flow first.",
    promptTitle: questStep(1, 7, "Title", "Send a clear quest title (3–100 characters)."),
    promptCategory: questStep(2, 7, "Category", "Select the category that best describes this quest."),
    promptDescription: questStep(
      3,
      7,
      "Description",
      "Describe the task workers should complete (minimum 10 characters).",
    ),
    promptReward: questStep(
      4,
      7,
      "Reward",
      "Send the reward amount per slot in NIM (example: `10`).",
    ),
    promptSlots: questStep(
      5,
      7,
      "Slots",
      "Send the number of available participant slots (example: `5`).",
    ),
    promptProofType: questStep(
      6,
      7,
      "Proof type",
      "Select the type of proof workers must submit.",
    ),
    promptProofInstructions: questStep(
      7,
      7,
      "Proof instructions",
      "Explain exactly what workers should submit (minimum 5 characters).",
    ),
    invalidTitle:
      "The title must be between 3 and 100 characters. Please restart from *Creator Hub* → *Create Quest*.",
    invalidDescription:
      "The description must be at least 10 characters. Please restart from *Creator Hub* → *Create Quest*.",
    invalidReward: "Please send a positive number for the reward (example: `10`).",
    invalidSlots: "Please send a positive whole number for slots (example: `5`).",
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
    publishNotFunded:
      "This quest isn't funded yet. Open *Creator Studio* from the Creator Hub to fund its escrow wallet with the reward pool, then publish from there.",
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
