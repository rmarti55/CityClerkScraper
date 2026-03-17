"use client";

import { useState, useEffect, useMemo } from "react";
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

const DEPARTMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Governing Body": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "Public Works": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Facilities Management": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Municipal Court": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

const DEFAULT_DEPT_COLOR = { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };

function DepartmentBadge({ department }: { department: string }) {
  const colors = DEPARTMENT_COLORS[department] ?? DEFAULT_DEPT_COLOR;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      {department}
    </span>
  );
}

function PersonCard({ person, highlighted }: { person: Person; highlighted: boolean }) {
  return (
    <div
      id={`person-${person.slug}`}
      className={`bg-white rounded-xl border p-4 transition-all hover:shadow-md hover:border-teal-300 ${
        highlighted ? "ring-2 ring-teal-400 border-teal-300" : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {person.photoUrl ? (
          <img
            src={person.photoUrl}
            alt={person.name}
            className="w-12 h-12 rounded-full object-cover border border-gray-200 shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center shrink-0 border border-teal-200">
            <span className="text-sm font-semibold text-teal-700">
              {getInitials(person.name)}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{person.name}</h3>
          {person.title && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{person.title}</p>
          )}
          {person.department && (
            <div className="mt-1.5">
              <DepartmentBadge department={person.department} />
            </div>
          )}
        </div>
      </div>

      {/* Contact info */}
      <div className="mt-3 space-y-1.5">
        {person.email && (
          <a
            href={`mailto:${person.email}`}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-teal-700 transition-colors group"
          >
            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate">{person.email}</span>
          </a>
        )}
        {person.phone && (
          <a
            href={`tel:${person.phone}`}
            className="flex items-center gap-2 text-xs text-gray-600 hover:text-teal-700 transition-colors group"
          >
            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{person.phone}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function DirectorySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded-full w-24" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-3 bg-gray-200 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PeopleDirectory() {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [highlightSlug, setHighlightSlug] = useState<string | null>(null);

  // Read highlight param from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const h = params.get("highlight");
    if (h) {
      setHighlightSlug(h);
      // Scroll to the person after data loads
      setTimeout(() => {
        const el = document.getElementById(`person-${h}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 500);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch("/api/people")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load people");
        return r.json() as Promise<Person[]>;
      })
      .then(setPeople)
      .catch((e) => setError(e instanceof Error ? e.message : "An error occurred"))
      .finally(() => setIsLoading(false));
  }, []);

  // Extract unique departments
  const departments = useMemo(() => {
    const depts = new Set<string>();
    for (const p of people) {
      if (p.department) depts.add(p.department);
    }
    return Array.from(depts).sort();
  }, [people]);

  // Filter people
  const filtered = useMemo(() => {
    let result = people;

    if (selectedDepartment) {
      result = result.filter((p) => p.department === selectedDepartment);
    }

    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.title?.toLowerCase().includes(q) ||
          p.department?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [people, selectedDepartment, searchQuery]);

  // Group by first letter of last name
  const grouped = useMemo(() => {
    const groups = new Map<string, Person[]>();
    for (const p of filtered) {
      const parts = p.name.split(/\s+/);
      const lastName = parts[parts.length - 1];
      const letter = lastName[0]?.toUpperCase() ?? "#";
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(p);
    }
    return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [filtered]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">People Directory</h1>
          <p className="text-gray-500 mt-1">
            City of Santa Fe officials and staff
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Meetings
        </Link>
      </div>

      {/* Search + filters */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, title, department, or email..."
            className="block w-full pl-10 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Department filter chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedDepartment(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              selectedDepartment === null
                ? "bg-teal-50 text-teal-700 border-teal-300"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            All ({people.length})
          </button>
          {departments.map((dept) => {
            const count = people.filter((p) => p.department === dept).length;
            const colors = DEPARTMENT_COLORS[dept] ?? DEFAULT_DEPT_COLOR;
            const isSelected = selectedDepartment === dept;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(isSelected ? null : dept)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  isSelected
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {dept} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <DirectorySkeleton />
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-medium text-red-800">Failed to Load Directory</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-500 text-sm">
            {searchQuery || selectedDepartment
              ? "No people match your search."
              : "No people in the directory yet."}
          </p>
          {!searchQuery && !selectedDepartment && (
            <p className="text-gray-400 text-xs mt-1">
              Run <code className="bg-gray-100 px-1 py-0.5 rounded">POST /api/admin/people/sync</code> to populate.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([letter, persons]) => (
            <div key={letter}>
              <div className="sticky top-0 z-10 bg-gray-50 py-1 mb-3">
                <h2 className="text-lg font-bold text-gray-300">{letter}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {persons.map((p) => (
                  <PersonCard
                    key={p.id}
                    person={p}
                    highlighted={p.slug === highlightSlug}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Count footer */}
      {!isLoading && filtered.length > 0 && (
        <div className="mt-8 text-center text-xs text-gray-400">
          Showing {filtered.length} of {people.length} people
        </div>
      )}
    </div>
  );
}
