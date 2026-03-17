import { redirect } from "next/navigation";
import { Metadata } from "next";
import { COMMITTEES } from "@/lib/committees";
import { SITE_NAME } from "@/lib/branding";

const committee = COMMITTEES["governing-body"];

export const metadata: Metadata = {
  title: `${committee.displayName} | ${SITE_NAME}`,
  description: committee.description,
};

export default function GoverningBodyPage() {
  redirect("/?tab=governing-body");
}
