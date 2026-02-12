import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Gradify Cases – Structured Case Management";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Subtle grid pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.05,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            display: "flex",
          }}
        />

        {/* Accent line top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #CE353A 0%, #e85d62 50%, #CE353A 100%)",
            display: "flex",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "16px",
              background: "#CE353A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "8px",
            }}
          >
            <span style={{ fontSize: "36px", color: "white", fontWeight: 700 }}>G</span>
          </div>

          {/* Title */}
          <span
            style={{
              fontSize: "56px",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-1px",
            }}
          >
            Gradify Cases
          </span>

          {/* Divider */}
          <div
            style={{
              width: "80px",
              height: "3px",
              background: "#CE353A",
              borderRadius: "2px",
              display: "flex",
            }}
          />

          {/* Subtitle */}
          <span
            style={{
              fontSize: "24px",
              fontWeight: 400,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            Structured Case Management
          </span>
        </div>

        {/* Domain bottom right */}
        <div
          style={{
            position: "absolute",
            bottom: "32px",
            right: "40px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              color: "rgba(255,255,255,0.35)",
              fontWeight: 500,
            }}
          >
            cases.gradify.de
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
