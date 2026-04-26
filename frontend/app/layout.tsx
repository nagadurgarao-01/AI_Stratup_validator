import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Startup Idea Validator | Validate Your Idea in Under 10 Minutes",
  description:
    "Transform raw business concepts into investor-ready strategies with real-time market research, competitor analysis, financial modeling, and viability scoring.",
  keywords: ["startup validation", "market research", "AI business plan", "viability score", "competitive analysis"],
  openGraph: {
    title: "AI Startup Idea Validator",
    description: "Validate your startup idea in under 10 minutes with AI-powered market research and financial modeling.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {/* Background ambient glows */}
        <div className="bg-glow bg-glow-purple" aria-hidden="true" />
        <div className="bg-glow bg-glow-cyan" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
