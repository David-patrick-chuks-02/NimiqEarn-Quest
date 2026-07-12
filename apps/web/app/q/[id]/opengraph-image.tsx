import { ImageResponse } from "next/og";

// Renders a readable, on-brand quest card so a shared /q/<id> link previews the quest
// itself (title, reward, slots, start) — not just a logo — in Telegram/Twitter/etc.

export const alt = "NimiqEarn Quest";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Cache the generated card for 5 minutes — social scrapers can unfurl it instantly instead
// of rendering + hitting the API on every request.
export const revalidate = 300;

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

const CATEGORY_LABELS: Record<string, string> = {
  PRODUCT_TESTING: "Product testing",
  SOCIAL_CAMPAIGN: "Social campaign",
  COMMUNITY_ENGAGEMENT: "Community engagement",
  REFERRAL: "Referral",
  CONTENT: "Content",
  FEEDBACK: "Feedback",
  BUG_BOUNTY: "Bug bounty",
  OTHER: "Quest",
};

interface PublicQuest {
  title: string;
  description: string;
  category: string;
  rewardAmount: string;
  totalSlots: number;
  slotsLeft: number;
  startAt: string | null;
  scheduled: boolean;
  promoted: boolean;
  creatorName: string | null;
}

async function getQuest(id: string): Promise<PublicQuest | null> {
  try {
    // count=0 — rendering the card (scrapers, studio thumbnails) must not inflate views.
    const res = await fetch(`${API_INTERNAL_URL}/api/quests/${encodeURIComponent(id)}?count=0`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { quest?: PublicQuest };
    return data.quest ?? null;
  } catch {
    return null;
  }
}

const GOLD = "#f6a91b";
const TEXT = "#e9eef7";
const MUTED = "#8a97ad";
const BG = "#070c17";

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700 }}>
      <div style={{ display: "flex", color: TEXT }}>Nimiq</div>
      <div style={{ display: "flex", color: GOLD }}>Earn</div>
      <div style={{ display: "flex", color: TEXT, marginLeft: 10 }}>Quest</div>
    </div>
  );
}

function Pill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "18px 26px",
        borderRadius: 20,
        background: accent ? "rgba(246,169,27,0.12)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${accent ? "rgba(246,169,27,0.35)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <div style={{ display: "flex", fontSize: 22, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 700, color: accent ? GOLD : TEXT }}>
        {value}
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quest = await getQuest(id);

  const baseCategory = quest ? (CATEGORY_LABELS[quest.category] ?? "Quest") : "Quest";
  const category = quest?.promoted ? `Promoted · ${baseCategory}` : baseCategory;
  const title = quest ? quest.title.slice(0, 90) : "This quest isn't available";
  const description = quest ? quest.description.slice(0, 160) : "Complete quests and earn NIM.";
  const reward = quest ? `${Number(quest.rewardAmount).toLocaleString()} NIM` : "—";
  const slots = quest ? `${quest.slotsLeft}/${quest.totalSlots}` : "—";
  const startsOn = quest?.scheduled && quest.startAt ? quest.startAt.slice(0, 10) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 70,
          background: `linear-gradient(160deg, #0a1120 0%, ${BG} 55%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Wordmark />
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 600,
              color: GOLD,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {category}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, color: TEXT, lineHeight: 1.05 }}>
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED, lineHeight: 1.35 }}>
            {description}
          </div>
          {quest?.creatorName ? (
            <div style={{ display: "flex", fontSize: 26, color: MUTED }}>
              by&nbsp;<div style={{ display: "flex", color: TEXT }}>{quest.creatorName}</div>
            </div>
          ) : null}
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 20 }}>
          <Pill label="Reward" value={reward} accent />
          <Pill label="Slots left" value={slots} />
          {startsOn ? <Pill label="Starts" value={startsOn} /> : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginLeft: "auto",
              fontSize: 26,
              fontWeight: 600,
              color: BG,
              background: GOLD,
              borderRadius: 999,
              padding: "18px 34px",
            }}
          >
            Do this quest →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
