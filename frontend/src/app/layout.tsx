import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";
import AuthSessionProvider from "@/components/AuthSessionProvider";
import CampoAuthGate from "@/components/CampoAuthGate";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const isCapacitor = process.env.CAPACITOR === "true";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Inspeção SSMA",
  description: "Plataforma de inspeção de segurança e relatório técnico",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Inspeção SSMA",
  },
  themeColor: "#1a5f3c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <CampoAuthGate>
      <AppShell>{children}</AppShell>
    </CampoAuthGate>
  );

  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        {isCapacitor ? body : <AuthSessionProvider>{body}</AuthSessionProvider>}
      </body>
    </html>
  );
}
