import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gradify Cases",
    short_name: "Gradify",
    description: "Structured Case Management Platform",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#CE353A",
    icons: [
      {
        src: "/icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
