import { ImageResponse } from "next/og";

// Dedicated /feedback unfurl card — so shared links don't fall back to the site logo/root preview.

export const alt = "Share feedback on NimiqEarn Quest";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

const GOLD = "#f6a91b";
const TEXT = "#e9eef7";
const MUTED = "#8a97ad";
const BG = "#070c17";

export default function Image() {
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
          background: `linear-gradient(155deg, #0a1120 0%, ${BG} 52%, #0c1018 100%)`,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Soft gold wash — matches marketing site atmosphere */}
        <div
          style={{
            position: "absolute",
            top: -80,
            left: 200,
            width: 700,
            height: 320,
            background: "radial-gradient(ellipse, rgba(246,169,27,0.14) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700 }}>
            <div style={{ display: "flex", color: TEXT }}>Nimiq</div>
            <div style={{ display: "flex", color: GOLD }}>Earn</div>
            <div style={{ display: "flex", color: TEXT, marginLeft: 10 }}>Quest</div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 600,
              color: GOLD,
              textTransform: "uppercase",
              letterSpacing: 2.5,
            }}
          >
            Community review
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, position: "relative" }}>
          <div
            style={{
              display: "flex",
              fontSize: 68,
              fontWeight: 800,
              color: TEXT,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 980,
            }}
          >
            Help us sharpen the Telegram build
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: MUTED,
              lineHeight: 1.4,
              maxWidth: 860,
            }}
          >
            Try @NimiqEarnBot, then leave anonymous feedback on what worked and what didn't.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>
            {["Open the bot", "Note friction", "Send feedback"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 22px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.03)",
                  fontSize: 22,
                  color: TEXT,
                  fontWeight: 500,
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 26,
              fontWeight: 700,
              color: BG,
              background: GOLD,
              borderRadius: 999,
              padding: "18px 34px",
            }}
          >
            Leave feedback →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
