"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Person } from "@/lib/db/schema";
import { PersonPopover } from "./PersonPopover";

// Shared client-side cache for people data
let peopleCache: Person[] | null = null;
let peopleFetchPromise: Promise<Person[]> | null = null;

function fetchPeopleOnce(): Promise<Person[]> {
  if (peopleCache) return Promise.resolve(peopleCache);
  if (peopleFetchPromise) return peopleFetchPromise;

  peopleFetchPromise = fetch("/api/people")
    .then((r) => {
      if (!r.ok) throw new Error("Failed to fetch people");
      return r.json() as Promise<Person[]>;
    })
    .then((data) => {
      peopleCache = data;
      return data;
    })
    .catch((err) => {
      peopleFetchPromise = null;
      throw err;
    });

  return peopleFetchPromise;
}

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
  const [person, setPerson] = useState<Person | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPeopleOnce().then((data) => {
      if (cancelled) return;
      const match = findPerson(data, email, name);
      if (match) setPerson(match);
    }).catch(() => {
      // Non-fatal: gracefully degrade to plain text
    });
    return () => { cancelled = true; };
  }, [name, email]);

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
