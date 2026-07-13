import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Reset: The Reprogram",
  description: "A self-help terminal for rebuilding consistency.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}