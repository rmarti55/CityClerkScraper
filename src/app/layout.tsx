import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { EventsProvider } from "@/context/EventsContext";
import { AuthProvider } from "@/context/AuthContext";
import { CommitteeProvider } from "@/context/CommitteeContext";
import { LoginModalProvider } from "@/context/LoginModalContext";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Santa Fe City Meetings",
  description: "Browse Santa Fe city council meetings, agendas, and public documents",
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
          <LoginModalProvider>
            <EventsProvider>
              <CommitteeProvider>{children}</CommitteeProvider>
            </EventsProvider>
          </LoginModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
