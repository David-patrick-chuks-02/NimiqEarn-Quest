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
      "/help — Show this message",
      "",
      "*Main menu*",
      "• *Start Earning* — Your worker status and what's next",
      "• *My Wallet* — Link your Nimiq address (coming soon)",
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

  walletComingSoon: [
    "*My Wallet*",
    "",
    "Wallet linking is coming in the next update.",
    "",
    "You'll connect a Nimiq address here to receive quest rewards. For now, make sure your worker profile is set up with /start.",
  ].join("\n"),

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
        "Wallet linking arrives in the next update — you'll need a Nimiq address to receive rewards.",
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
