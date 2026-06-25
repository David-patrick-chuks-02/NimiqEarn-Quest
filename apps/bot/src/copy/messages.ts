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
};
