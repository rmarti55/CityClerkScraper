import { Metadata } from "next";
import { GoverningBodyScrollRestore } from "@/components/GoverningBodyScrollRestore";
import { COMMITTEES } from "@/lib/committees";

const committee = COMMITTEES["governing-body"];

export const metadata: Metadata = {
  title: `${committee.displayName} | Santa Fe City Meetings`,
  description: committee.description,
};

export default function GoverningBodyPage() {
  return <GoverningBodyScrollRestore />;
}
