import { Resvg } from "@resvg/resvg-js";
import { InputFile } from "grammy";
import svgCaptcha from "svg-captcha";
import { messages } from "./copy/messages.js";
import type { BotContext } from "./context.js";

/**
 * Generate an image CAPTCHA. svg-captcha renders each glyph as a vector <path> (no <text>),
 * so resvg can rasterize it to PNG without any system font — safe on headless deploys.
 */
export function generateCaptcha(): { text: string; png: Buffer } {
  const captcha = svgCaptcha.create({
    size: 4,
    charPreset: "ABCDEFGHJKMNPQRSTUVWXYZ23456789", // uppercase, no ambiguous 0/O/1/I/L
    noise: 3,
    color: true,
    width: 220,
    height: 90,
    fontSize: 64,
  });
  const png = new Resvg(captcha.data, { background: "white" }).render().asPng();
  return { text: captcha.text.toUpperCase(), png: Buffer.from(png) };
}

/**
 * Send a fresh CAPTCHA and record the expected answer + the message id (so a wrong answer
 * can delete it and issue a new one). Any pending /start deep-link payload is carried through
 * so the user still lands on the right place after verifying.
 */
export async function sendCaptcha(ctx: BotContext, startPayload?: string) {
  const { text, png } = generateCaptcha();
  const message = await ctx.replyWithPhoto(new InputFile(png, "captcha.png"), {
    caption: messages.captcha.prompt,
  });
  ctx.session.captcha = { answer: text, messageId: message.message_id, startPayload };
}
