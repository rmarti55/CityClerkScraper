import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/branding";
import { EventsProvider } from "@/context/EventsContext";
import { AuthProvider } from "@/context/AuthContext";
import { CommitteeProvider } from "@/context/CommitteeContext";
import { FollowsProvider } from "@/context/FollowsContext";
import { LoginModalProvider } from "@/context/LoginModalContext";
import { ToastProvider } from "@/context/ToastContext";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} antialiased`}
      >
        <AuthProvider>
          <FollowsProvider>
          <LoginModalProvider>
            <ToastProvider>
              <EventsProvider>
                <CommitteeProvider>{children}</CommitteeProvider>
              </EventsProvider>
            </ToastProvider>
          </LoginModalProvider>
          </FollowsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
