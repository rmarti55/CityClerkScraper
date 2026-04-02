/**
 * Send a test transcript-ready email with realistic sample data.
 * Usage: npx tsx scripts/test-transcript-email.ts [email]
 *
 * If no email is provided, queries the first user in the database.
 */

import path from "path";
import { config } from "dotenv";

const projectRoot = path.resolve(process.cwd());
config({ path: path.join(projectRoot, ".env") });
config({ path: path.join(projectRoot, ".env.local") });

if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not set");
  process.exit(1);
}

async function main() {
  const { sendTranscriptReadyEmail } = await import(
    "../src/emails/transcript-ready"
  );
  const { db } = await import("../src/lib/db");
  const { users } = await import("../src/lib/db/schema");

  let to = process.argv[2];
  if (!to) {
    const rows = await db
      .select({ email: users.email })
      .from(users)
      .limit(1);
    to = rows[0]?.email;
    if (!to) {
      console.error("No users found in database and no email argument given");
      process.exit(1);
    }
  }

  console.log(`Sending test transcript-ready email to: ${to}\n`);

  const appUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const { id, error } = await sendTranscriptReadyEmail({
    to,
    eventName: "Regular Governing Body Meeting - Second Wednesday",
    eventId: 1234,
    startDateTime: "2026-03-11T23:30:00.000Z",
    categoryName: "Governing Body",
    summary: {
      executiveSummary:
        "The Santa Fe Governing Body met on March 11, 2026, addressing a range of community issues and city operations. Key discussions included the temporary placement of the Soldiers Monument remnants in the New Mexico History Museum, which was approved despite concerns about cost and the need for a permanent solution. The council also unanimously approved a significant contract amendment for Phase Two of the Land Development Code update, expanding its scope and budget to ensure a comprehensive and updated code, with a focus on improving public access to information about the changes.\n\nPublic engagement was a prominent feature, with residents voicing strong opinions on the proposed Marriott hotel development, the future of the obelisk in the plaza, and the need for greater transparency in city government contact information. The meeting also saw the introduction of several new pieces of legislation, including a bill to streamline alcohol sales at city events and a loan agreement for McClure Dam design. The council approved two ordinances related to critical water infrastructure improvements at the Canyon Road Water Treatment Plant, securing over $24 million in loans and grants.",
      keyDecisions: [
        "Resolution to temporarily place the Soldiers Monument remnants in the New Mexico History Museum was approved (7 'Yes,' 1 'No').",
        "Contract amendment for Phase Two of the Land Development Code update, reassigning it to Gobel Partners LLC, expanding scope, increasing compensation by $519,657 (totaling $766,354.6), and extending the term to December 31, 2027, was approved unanimously (8-0).",
        "Motion to take no action on the executive session item was passed (7-0 roll call vote).",
        "Motion to move directly to Item 21 (Appointments) before public comment was passed (8-0 roll call vote).",
        "Appointments to the City's committees for the April 2027 term (Rod Gold, Kendell Chavez, John Paul Granil, Roberta Duran, and Lily May Ortiz) were unanimously approved.",
        "Bill Number 2024-14 (Backflow Prevention and Control) was approved unanimously (8-0 roll call vote).",
        "Bill Number 2026-1 (Canyon Road Water Treatment Plant Loan/Grant) was approved unanimously (8-0 roll call vote).",
      ],
      motionsAndVotes: [
        "Approval of agenda with one amendment (removal of item 9W) — Approved.",
        "Approval of consent agenda (with item 9V removed for separate consideration) — Approved.",
        "Resolution to temporarily place the Soldiers Monument remnants in the New Mexico History Museum — Passed 7-1.",
        "Approval of LDC Phase Two contract amendment, reassignment, scope expansion, increased compensation, and term extension — Passed unanimously (8-0).",
        "Motion to take no action on the executive session item — Passed 7-0 roll call vote.",
        "Bill Number 2024-14 (Backflow Prevention and Control) — Passed unanimously (8-0 roll call vote).",
        "Bill Number 2026-1 (Canyon Road Water Treatment Plant Loan/Grant) — Passed unanimously (8-0 roll call vote).",
      ],
      actionItems: [
        "City Manager is authorized to work with state officials to enter into a temporary loan agreement for the Soldiers Monument remnants.",
        "Consultant (Mr. Goel) to begin work immediately on Phase Two of the Land Development Code update once the contract is processed.",
        "Consultant/Staff to update the Land Development Code project website and encourage public sign-ups for the listserv.",
        "Staff/City Attorney's Office to confirm the prioritization of LDC changes with Mr. Goel, particularly regarding the classification of clerical errors.",
        "City Clerk to conduct roll call votes as requested.",
        "Michael (Staff) to set up and manage the timer for public speakers.",
      ],
      publicCommentsSummary:
        "Public comments covered a wide range of topics. Several residents expressed strong opposition to a proposed four-story Marriott hotel, citing concerns about height, architectural fit, traffic, and parking, urging the governing body to appeal the Planning Commission's decision. The future of the obelisk/Soldiers Monument also generated divided opinions, with some advocating for its rebuilding as a historical monument and others arguing for its complete removal due to damage and its painful legacy. Concerns were raised about the proposed city department reorganization (Bill Number 2026-3), the selection process for Charter Commission members, and slow responses from city departments regarding citations.",
    },
    topics: [
      { topic: "City Department Reorganization", keywords: ["reorganization"], relevanceScore: 90 },
      { topic: "Water Treatment Plant Funding", keywords: ["water", "canyon road"], relevanceScore: 88 },
      { topic: "4Kids Youth Recreation Program", keywords: ["4kids", "youth"], relevanceScore: 75 },
      { topic: "Backflow Prevention Ordinance", keywords: ["backflow"], relevanceScore: 72 },
      { topic: "Land Development Code", keywords: ["LDC", "development"], relevanceScore: 95 },
      { topic: "Soldiers Monument", keywords: ["obelisk", "monument"], relevanceScore: 92 },
      { topic: "Marriott Hotel Development", keywords: ["marriott", "hotel"], relevanceScore: 85 },
      { topic: "Consent Agenda Approval", keywords: ["consent"], relevanceScore: 60 },
      { topic: "Public Comment Procedures", keywords: ["public comment"], relevanceScore: 55 },
    ],
    reason: 'You follow the category "Governing Body".',
    appUrl,
  });

  if (error) {
    console.error("Send failed:", error);
    process.exit(1);
  }

  console.log(`Email sent successfully! Resend ID: ${id}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
