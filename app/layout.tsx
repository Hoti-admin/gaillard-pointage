import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gaillard Pointage",
  description: "Pointage employés - GAILLARD Jean-Paul SA",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b1220",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
