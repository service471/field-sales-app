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
          alignItems: "center",
          justifyContent: "center",
          background: "#1f6b4a",
        }}
      >
        <div
          style={{
            width: "78%",
            height: "78%",
            borderRadius: 36,
            background: "#f3efe6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#1c1915",
            fontSize: 58,
            fontWeight: 650,
          }}
        >
          FS
        </div>
      </div>
    ),
    { ...size },
  );
}
