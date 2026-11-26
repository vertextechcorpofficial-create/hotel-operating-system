import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function HosRootPage() {
    redirect("/hos/front-desk-dashboard");
}
