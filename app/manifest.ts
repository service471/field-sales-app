import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Field Sales",
    short_name: "Field Sales",
    description: "Mobile CRM for working through company visits one card at a time.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe6",
    theme_color: "#1c1915",
    lang: "en",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
