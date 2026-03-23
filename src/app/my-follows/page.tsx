import { redirect } from "next/navigation";

export default function MyFollowsPage() {
  redirect("/?tab=following");
}
