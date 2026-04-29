import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#050a0e",
          borderRadius: 40,
          gap: 4,
        }}
      >
        <div
          style={{
            color: "#00ffe7",
            fontSize: 52,
            fontWeight: "bold",
            letterSpacing: "-2px",
            lineHeight: 1,
          }}
        >
          BTC
        </div>
        <div
          style={{
            color: "#00ffe7",
            fontSize: 18,
            fontWeight: "bold",
            letterSpacing: "6px",
            opacity: 0.6,
          }}
        >
          ORACLE
        </div>
      </div>
    ),
    { ...size }
  );
}
