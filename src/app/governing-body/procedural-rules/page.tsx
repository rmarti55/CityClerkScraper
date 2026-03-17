import { Metadata } from "next";
import fs from "fs";
import path from "path";
import { SITE_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: `Procedural Rules | Governing Body | ${SITE_NAME}`,
  description:
    "Governing Body Procedural Rules for the City of Santa Fe, adopted January 12, 2022.",
};

const OFFICIAL_PDF_URL =
  "https://santafenm.gov/Governing_Body_Procedural_Rules_-_Adopted_January_12%2C_2022.pdf";
const OFFICIAL_PAGE_URL =
  "https://santafenm.gov/city-clerk-1/ordinances-resolutions-and-the-city-charter/precedural-rules";

function getMarkdownContent(): string {
  const filePath = path.join(
    process.cwd(),
    "docs",
    "governing-body-procedural-rules.md"
  );
  return fs.readFileSync(filePath, "utf-8");
}

function markdownToSections(md: string) {
  const lines = md.split("\n");
  const sections: { level: number; title: string; content: string }[] = [];
  let currentSection: { level: number; title: string; lines: string[] } | null =
    null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      if (currentSection) {
        sections.push({
          level: currentSection.level,
          title: currentSection.title,
          content: currentSection.lines.join("\n").trim(),
        });
      }
      currentSection = {
        level: headingMatch[1].length,
        title: headingMatch[2],
        lines: [],
      };
    } else if (currentSection) {
      currentSection.lines.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      level: currentSection.level,
      title: currentSection.title,
      content: currentSection.lines.join("\n").trim(),
    });
  }

  return sections;
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-700 underline">$1</a>'
    );
}

function renderContent(content: string) {
  if (!content) return null;

  const blocks = content.split("\n\n").filter(Boolean);
  return blocks.map((block, i) => {
    const trimmed = block.trim();

    if (trimmed === "---") {
      return <hr key={i} className="my-4 border-gray-200" />;
    }

    if (trimmed.startsWith(">")) {
      const quoteText = trimmed
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join("\n");
      return (
        <blockquote
          key={i}
          className="border-l-4 border-indigo-200 bg-indigo-50/50 pl-4 py-3 my-3 text-sm text-gray-700 rounded-r-lg"
          dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(quoteText) }}
        />
      );
    }

    if (trimmed.startsWith("- ")) {
      const items = trimmed.split("\n").filter((l) => l.startsWith("- "));
      return (
        <ul key={i} className="list-disc list-outside pl-5 space-y-1 my-2">
          {items.map((item, j) => (
            <li
              key={j}
              className="text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: renderInlineMarkdown(item.replace(/^- /, "")),
              }}
            />
          ))}
        </ul>
      );
    }

    if (/^\d+\./.test(trimmed)) {
      const items = trimmed.split("\n").filter((l) => /^\d+\./.test(l.trim()));
      return (
        <ol key={i} className="list-decimal list-outside pl-5 space-y-1 my-2">
          {items.map((item, j) => (
            <li
              key={j}
              className="text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: renderInlineMarkdown(
                  item.replace(/^\d+\.\s*/, "").trim()
                ),
              }}
            />
          ))}
        </ol>
      );
    }

    return (
      <p
        key={i}
        className="text-sm text-gray-700 leading-relaxed my-2"
        dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(trimmed) }}
      />
    );
  });
}

export default function ProceduralRulesPage() {
  const md = getMarkdownContent();
  const sections = markdownToSections(md);

  const toc = sections.filter((s) => s.level === 2);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Governing Body Procedural Rules
          </h1>
          <p className="text-sm text-gray-500 mb-4">
            Adopted January 12, 2022 &mdash; Resolution No. 2022-4
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={OFFICIAL_PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Official PDF
            </a>
            <a
              href={OFFICIAL_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              Verify Current Version
            </a>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-500 mb-3">
            Table of Contents
          </h2>
          <nav className="space-y-1">
            {toc.map((section, i) => (
              <a
                key={i}
                href={`#section-${i}`}
                className="block text-sm text-gray-700 hover:text-indigo-600 py-0.5"
              >
                {section.title}
              </a>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {sections.map((section, i) => {
            if (section.level === 1) return null;

            const tocIndex = toc.indexOf(section);
            const id = tocIndex >= 0 ? `section-${tocIndex}` : undefined;

            const headingClass =
              section.level === 2
                ? "text-lg font-bold text-gray-900 mt-8 mb-3 pt-6 border-t border-gray-100 first:mt-0 first:pt-0 first:border-0"
                : section.level === 3
                  ? "text-base font-semibold text-gray-900 mt-5 mb-2"
                  : "text-sm font-semibold text-gray-700 mt-4 mb-1.5";

            const heading =
              section.level === 2 ? (
                <h2 className={headingClass}>{section.title}</h2>
              ) : section.level === 3 ? (
                <h3 className={headingClass}>{section.title}</h3>
              ) : (
                <h4 className={headingClass}>{section.title}</h4>
              );

            return (
              <div key={i} id={id}>
                {heading}
                {renderContent(section.content)}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-400 text-center mt-6">
          This is a local copy for reference. Always{" "}
          <a
            href={OFFICIAL_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-500"
          >
            check the official City of Santa Fe page
          </a>{" "}
          to confirm this document is still current.
        </p>
      </div>
    </div>
  );
}
