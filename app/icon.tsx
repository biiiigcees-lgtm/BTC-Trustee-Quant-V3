import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050a0e",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            color: "#00ffe7",
            fontSize: 14,
            fontWeight: "bold",
            letterSpacing: "-1px",
          }}
        >
          BTC
        </div>
      </div>
    ),
    { ...size }
  );
}
