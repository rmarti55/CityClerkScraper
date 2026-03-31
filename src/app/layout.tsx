import type { Metadata } from "next";
import { Suspense } from "react";
import { Lato } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/branding";
import { AuthProvider } from "@/context/AuthContext";
import { FollowsProvider } from "@/context/FollowsContext";
import { SavedDocsProvider } from "@/context/SavedDocsContext";
import { LoginModalProvider } from "@/context/LoginModalContext";
import { ToastProvider } from "@/context/ToastContext";
import { MeetingsProviders } from "@/components/MeetingsProviders";
import { SearchProvider } from "@/context/SearchContext";
import { AppHeader } from "@/components/AppHeader";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://santafeminutes.space"),
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
        className={`${lato.variable} antialiased`}
      >
        <AuthProvider>
          <FollowsProvider>
          <SavedDocsProvider>
          <LoginModalProvider>
            <ToastProvider>
              <MeetingsProviders>
                <Suspense>
                  <SearchProvider>
                    <AppHeader />
                    {children}
                  </SearchProvider>
                </Suspense>
              </MeetingsProviders>
            </ToastProvider>
          </LoginModalProvider>
          </SavedDocsProvider>
          </FollowsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
