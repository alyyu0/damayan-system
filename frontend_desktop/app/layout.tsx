import type { Metadata } from "next";
import 'leaflet/dist/leaflet.css';
import "./globals.css";

export const metadata: Metadata = {
  title: "Damayan",
  description: "Damayan desktop frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
