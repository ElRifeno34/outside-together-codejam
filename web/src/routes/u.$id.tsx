import { useLanguage } from "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ProfileView } from "@/components/profile-view";

/** Someone's public profile: grade, trophies and cosmetics (migration 019). */
export const Route = createFileRoute("/u/$id")({
  head: () => ({ meta: [{ title: "Profile · Outside Together" }] }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { tr } = useLanguage();
  const { id } = Route.useParams();
  return (
    <main className="page-width">
      <div className="page-title">
        <Link to="/rankings" className="back-link">
          <ArrowLeft size={15} />
          {tr("Back to rankings")}
        </Link>
      </div>
      <ProfileView userId={id} />
    </main>
  );
}
