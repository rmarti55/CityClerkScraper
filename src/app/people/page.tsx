import { Suspense } from "react";
import { PeopleDirectory } from "@/components/PeopleDirectory";

export const metadata = {
  title: "People Directory — City of Santa Fe",
  description: "Contact directory for City of Santa Fe officials and staff",
};

export default function PeoplePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6 lg:max-w-none lg:px-12">
        <Suspense fallback={null}>
          <PeopleDirectory />
        </Suspense>
      </div>
    </main>
  );
}
