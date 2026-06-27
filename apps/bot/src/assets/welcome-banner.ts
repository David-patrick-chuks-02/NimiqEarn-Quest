import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { InputFile } from "grammy";

const botRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const welcomeBannerPath = join(botRoot, "assets/welcome-banner.jpg");

export function welcomeBannerFile() {
  return new InputFile(welcomeBannerPath);
}
