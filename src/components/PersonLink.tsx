"use client";

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import type { Person } from "@/lib/db/schema";
import { PersonPopover } from "./PersonPopover";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Failed to fetch people");
    return r.json() as Promise<Person[]>;
  });

function findPerson(
  people: Person[],
  email?: string | null,
  name?: string
): Person | undefined {
  if (email) {
    const byEmail = people.find(
      (p) => p.email?.toLowerCase() === email.toLowerCase()
    );
    if (byEmail) return byEmail;
  }
  if (name) {
    const byName = people.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (byName) return byName;
  }
  return undefined;
}

interface PersonLinkProps {
  name: string;
  email?: string | null;
  children: React.ReactNode;
}

export function PersonLink({ name, email, children }: PersonLinkProps) {
  const { data: people } = useSWR<Person[]>("/api/people", fetcher);
  const person = people ? findPerson(people, email, name) : null;

  const [showPopover, setShowPopover] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!person) return;
      e.preventDefault();
      e.stopPropagation();
      if (spanRef.current) {
        setAnchorRect(spanRef.current.getBoundingClientRect());
      }
      setShowPopover((prev) => !prev);
    },
    [person]
  );

  const handleClose = useCallback(() => {
    setShowPopover(false);
  }, []);

  if (!person) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        ref={spanRef}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        className="cursor-pointer text-teal-700 hover:text-teal-900 hover:underline decoration-teal-300 underline-offset-2 transition-colors"
      >
        {children}
      </span>
      {showPopover && anchorRect && typeof document !== "undefined" &&
        createPortal(
          <PersonPopover
            person={person}
            anchorRect={anchorRect}
            onClose={handleClose}
          />,
          document.body
        )}
    </>
  );
}
