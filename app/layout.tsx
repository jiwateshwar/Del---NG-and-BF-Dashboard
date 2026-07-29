import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RBT Operations Dashboard",
  description: "Daily and weekly operations review dashboard for Ring Back Tone accounts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "var(--page-plane)" }}>
        {children}
      </body>
    </html>
  );
}
