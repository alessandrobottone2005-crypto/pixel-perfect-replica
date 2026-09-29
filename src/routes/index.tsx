import { createFileRoute } from "@tanstack/react-router";
import { AsciiStudio } from "@/components/studio/AsciiStudio";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ASCII Studio — Generative Typography & 3D Artwork" },
      {
        name: "description",
        content:
          "A dark-mode studio for generative ASCII art: procedural backgrounds, kinetic typography, lit 3D primitives, and PNG, SVG, WebM exports.",
      },
      { property: "og:title", content: "ASCII Studio — Generative Typography & 3D Artwork" },
      {
        property: "og:description",
        content:
          "Compose procedural noise, kinetic type, and lit 3D shapes into live ASCII art, then export for print, plotter, or video.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  return (
    <>
      <AsciiStudio />
      <Toaster />
    </>
  );
}
