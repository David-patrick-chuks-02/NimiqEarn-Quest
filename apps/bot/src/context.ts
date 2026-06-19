import type { Context, SessionFlavor } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";
import type { SessionData } from "./types.js";

type BaseContext = Context & SessionFlavor<SessionData>;

export type BotContext = BaseContext & ConversationFlavor<BaseContext>;
