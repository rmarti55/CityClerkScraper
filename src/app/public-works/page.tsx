import { Metadata } from "next";
import { PublicWorksScrollRestore } from "@/components/PublicWorksScrollRestore";
import { COMMITTEES } from "@/lib/committees";
import { SITE_NAME } from "@/lib/branding";

const committee = COMMITTEES["public-works"];

export const metadata: Metadata = {
  title: `${committee.displayName} | ${SITE_NAME}`,
  description: committee.description,
};

export default function PublicWorksPage() {
  return <PublicWorksScrollRestore />;
}
