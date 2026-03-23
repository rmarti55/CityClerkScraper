"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { COMMITTEES } from "@/lib/committees";
import { TabBar, TabValue } from "./TabBar";
import { LoginButton } from "./LoginButton";

export function AppHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const getActiveTab = (): TabValue => {
    if (pathname === "/" || pathname === "") {
      const tabParam = searchParams.get("tab");
      if (tabParam && COMMITTEES[tabParam]) return tabParam;
      return "all";
    }
    if (pathname === "/people") return "people";
    return "none";
  };

  const activeTab = getActiveTab();
  const isHomePage = pathname === "/" || pathname === "";
  const isMeetingPage = pathname.startsWith("/meeting/");
  const isSubPage = !isHomePage && !isMeetingPage;

  const handleTabChange = useCallback(
    (tab: TabValue) => {
      if (tab === "all") {
        router.push("/");
      } else {
        router.push(`/?tab=${tab}`);
      }
    },
    [router]
  );

  const meetingBackHref = (() => {
    if (!isMeetingPage) return "/";
    const from = searchParams.get("from");
    if (from) {
      const path = from.trim().replace(/^\//, "");
      if (path) return `/${path}`;
    }
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    const category = searchParams.get("category");
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  })();

  const subPageInfo = (() => {
    if (pathname === "/my-follows") return { title: "My Follow", backHref: "/" };
    if (pathname === "/profile") return { title: "Alert Settings", backHref: "/my-follows" };
    if (pathname.includes("/procedural-rules")) return { title: "Procedural Rules", backHref: "/?tab=governing-body" };
    if (pathname === "/people") return { title: "People Directory", backHref: "/" };
    if (pathname.startsWith("/auth/")) return null;
    return null;
  })();

  const hasRow2 = isMeetingPage || (isSubPage && subPageInfo !== null);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        {/* Row 1: Tab bar + Login */}
        <div className={hasRow2 ? "border-b border-gray-100" : ""}>
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center justify-between">
            <TabBar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              compact
            />
              <div className="flex-shrink-0 pl-2">
                <LoginButton />
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Back navigation for meeting detail and subpages */}
        {isMeetingPage && (
          <BackRow label="Back to meetings" href={meetingBackHref} scroll={false} />
        )}
        {isSubPage && subPageInfo && (
          <BackRow label={subPageInfo.title} href={subPageInfo.backHref} />
        )}
      </header>
      {/* Spacer matching header height so content isn't hidden behind the fixed header */}
      <div className={hasRow2 ? "h-[84px]" : "h-[44px]"} />
    </>
  );
}

function BackRow({ label, href, scroll }: { label: string; href: string; scroll?: boolean }) {
  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="flex items-center gap-3 h-10">
        <Link
          href={href}
          scroll={scroll}
          className="flex items-center gap-1.5 text-sm text-gray-900 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {label}
        </Link>
      </div>
    </div>
  );
}
