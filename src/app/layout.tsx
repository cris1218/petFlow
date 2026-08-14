import type { Metadata } from "next";
import localFont from "next/font/local";
import { APP_NAME, APP_SLOGAN } from "@/lib/constants";
import { AppFeedback } from "@/components/app-feedback";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} · ${APP_SLOGAN}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_SLOGAN,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-dvh font-sans`}
      >
        <AppFeedback>{children}</AppFeedback>
      </body>
    </html>
  );
}
