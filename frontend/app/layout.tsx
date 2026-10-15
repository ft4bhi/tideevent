import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Container } from "@/components/layout/container";
import { Footer } from "@/components/layout/footer";
import { MockBanner } from "@/components/layout/mock-banner";
import { Navbar } from "@/components/layout/navbar";
import { SessionProvider } from "@/features/auth/session-context";
import { SITE } from "@/config/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: SITE.name,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SessionProvider>
          <MockBanner />
          <Navbar />
          <main className="flex-1">
            <Container className="py-8">{children}</Container>
          </main>
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}
