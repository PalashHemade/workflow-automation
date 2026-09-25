import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import DashboardOverview from "@/components/DashboardOverview";
import LandingPage from "@/components/marketing/LandingPage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    return <DashboardOverview />;
  }

  return <LandingPage />;
}
