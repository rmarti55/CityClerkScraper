"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Person } from "@/lib/db/schema";

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface PersonPopoverProps {
  person: Person;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function PersonPopover({ person, anchorRect, onClose }: PersonPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Position the popover below the anchor, centered horizontally
  const top = anchorRect.bottom + window.scrollY + 8;
  const left = Math.max(
    8,
    Math.min(
      anchorRect.left + anchorRect.width / 2 - 140,
      window.innerWidth - 296
    )
  );

  return (
    <div
      ref={popoverRef}
      className="fixed z-[100] w-[280px] bg-white rounded-xl border border-gray-200 shadow-lg p-4 animate-in fade-in duration-150"
      style={{ top, left, position: "absolute" }}
    >
      {/* Arrow */}
      <div
        className="absolute -top-2 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"
        style={{ left: Math.min(Math.max(anchorRect.left - left + anchorRect.width / 2 - 8, 16), 248) }}
      />

      <div className="flex items-start gap-3">
        {person.photoUrl ? (
          <img
            src={person.photoUrl}
            alt={person.name}
            className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center shrink-0 border border-teal-200">
            <span className="text-xs font-semibold text-teal-700">
              {getInitials(person.name)}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
          {person.title && (
            <p className="text-xs text-gray-600 truncate">{person.title}</p>
          )}
          {person.department && (
            <p className="text-xs text-gray-500 mt-0.5">{person.department}</p>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {person.email && (
          <a
            href={`mailto:${person.email}`}
            className="flex items-center gap-2 text-xs text-gray-700 hover:text-teal-700 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3.5 h-3.5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {person.email}
          </a>
        )}
        {person.phone && (
          <a
            href={`tel:${person.phone}`}
            className="flex items-center gap-2 text-xs text-gray-700 hover:text-teal-700 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3.5 h-3.5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {person.phone}
          </a>
        )}
      </div>

      <Link
        href={`/people?highlight=${person.slug}`}
        className="mt-3 flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
        onClick={onClose}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        View in directory
      </Link>
    </div>
  );
}
