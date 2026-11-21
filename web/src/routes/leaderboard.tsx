import { useLanguage } from "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Trophy,
  Users,
  MapPin,
  Flag,
  Globe2,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { getLeaderboard, getRankingLocations } from "@/api";
import type { RankingScope } from "@/data/rankings";
const worldOptions = queryOptions({
  queryKey: ["leaderboard", "world"],
  queryFn: () => getLeaderboard("world"),
});
const locationOptions = queryOptions({
  queryKey: ["ranking-locations"],
  queryFn: getRankingLocations,
});
export const Route = createFileRoute("/leaderboard")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(worldOptions),
      context.queryClient.ensureQueryData(locationOptions),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Friends & world rankings · Outside Together" },
      {
        name: "description",
        content:
          "Compare activity points with friends and explore city, country, and worldwide Outside Together rankings.",
      },
      { property: "og:title", content: "Friends & world rankings · Outside Together" },
      {
        property: "og:description",
        content:
          "A little friendly competition. See who is earning points outside in Montréal and beyond.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Leaderboard,
});
const scopes: { id: RankingScope; label: string; Icon: typeof Users }[] = [
  { id: "friends", label: "Friends", Icon: Users },
  { id: "city", label: "City", Icon: MapPin },
  { id: "country", label: "Country", Icon: Flag },
  { id: "world", label: "World", Icon: Globe2 },
];
function Leaderboard() {
  const { tr, language } = useLanguage();
  const { profile, openAuth } = useApp();
  const [scope, setScope] = useState<RankingScope>("world");
  const [city, setCity] = useState("Montréal");
  const [country, setCountry] = useState("Canada");
  const { data: locations } = useSuspenseQuery(locationOptions);
  const location = scope === "city" ? city : scope === "country" ? country : undefined;
  const ranking = useQuery({
    queryKey: ["leaderboard", scope, location, profile?.id],
    queryFn: () => getLeaderboard(scope, location),
    enabled: scope !== "friends" || !!profile,
  });
  const own = ranking.data?.find((p) => p.id === profile?.id);
  return (
    <main className="page-width leaderboard-page">
      <div className="page-title">
        <Link className="back-link" to="/">
          <ArrowLeft size={15} />
          {tr("Back to activities")}
        </Link>
        <div className="eyebrow mt-7">
          <Trophy size={14} />
          {tr("A little friendly competition")}
        </div>
        <h1>{tr("Good company. Great company.")}</h1>
        <p>{tr("Every hour outside adds up.")}</p>
      </div>
      <div className="ranking-toolbar">
        <div className="ranking-tabs" role="tablist" aria-label={tr("Ranking scope")}>
          {scopes.map(({ id, label, Icon }) => (
            <Button
              key={id}
              role="tab"
              aria-selected={scope === id}
              variant="pill"
              data-active={scope === id}
              onClick={() => setScope(id)}
            >
              <Icon />
              {tr(label ?? "")}
            </Button>
          ))}
        </div>
        <div className="ranking-tools">
          {scope === "city" && (
            <select
              className="filter-select"
              aria-label={tr("Ranking city")}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              {locations.cities.map((c) => (
                <option key={c} value={c}>
                  {tr(c)}
                </option>
              ))}
            </select>
          )}
          {scope === "country" && (
            <select
              className="filter-select"
              aria-label={tr("Ranking country")}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              {locations.countries.map((c) => (
                <option key={c} value={c}>
                  {tr(c)}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={tr("Refresh rankings")}
            title={tr("Refresh rankings")}
            disabled={ranking.isFetching || (scope === "friends" && !profile)}
            onClick={() => void ranking.refetch()}
          >
            <RefreshCw className={ranking.isFetching ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>
      <div className="ranking-caption">
        <span>
          {scope === "world"
            ? tr("Worldwide")
            : scope === "friends"
              ? tr("Your friends")
              : location}{" "}
          {tr("· All-time points")}
        </span>
        <span className="niche-badge">{tr("Demo rankings")}</span>
      </div>
      {scope === "friends" && !profile ? (
        <div className="empty-state">
          <Users size={32} />
          <h2>{tr("Your circle, a little closer.")}</h2>
          <p>{tr("Sign in to see your friends’ points.")}</p>
          <Button onClick={() => openAuth()}>
            {tr("Sign in")}
            <ArrowUpRight />
          </Button>
        </div>
      ) : ranking.isPending ? (
        <div className="empty-state" role="status">
          {tr("Loading rankings…")}
        </div>
      ) : ranking.isError ? (
        <div className="empty-state">
          <h2>{tr("Rankings couldn’t load.")}</h2>
          <Button onClick={() => void ranking.refetch()}>{tr("Try again")}</Button>
        </div>
      ) : (
        <>
          {own && (
            <div className="your-ranking">
              <div>
                <Sparkles size={18} />
                <span>
                  {tr("Your rank")}
                  <strong>
                    {tr("#")}
                    {own.rank}
                  </strong>
                </span>
              </div>
              <span>
                {own.total_points} {tr("pts")}
              </span>
            </div>
          )}
          <div className="ranking-table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th scope="col">{tr("Rank")}</th>
                  <th scope="col">{tr("Outside together")}</th>
                  <th scope="col">{tr("Points")}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.data?.map((p) => (
                  <tr key={p.id} data-you={p.id === profile?.id}>
                    <td>
                      <span className={p.rank === 1 ? "rank-number rank-first" : "rank-number"}>
                        {p.rank === 1 ? <Trophy size={17} /> : p.rank}
                      </span>
                    </td>
                    <td>
                      <div className="ranking-person">
                        <span className="ranking-avatar">{p.display_name.charAt(0)}</span>
                        <div>
                          <strong>
                            {p.display_name}
                            {p.id === profile?.id && <span className="you-label">{tr("You")}</span>}
                          </strong>
                          <small>
                            {tr(p.city)}
                            {", "}
                            {tr(p.country ?? "")}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td className="ranking-score">
                      {p.total_points}
                      <small>{tr("pts")}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ranking.data?.length && (
            <div className="empty-state">
              <h2>{tr("No rankings here yet.")}</h2>
              <p>{tr("Choose another location.")}</p>
            </div>
          )}
        </>
      )}
      <section className="points-band">
        <Sparkles />
        <div>
          <h3>{tr("A little more niche. A little more rewarding.")}</h3>
          <p>
            {tr(
              "Points = 10 + 5 × niche value, once 2 participants check in. Equal points share a rank.",
            )}
          </p>
        </div>
        <Link to="/">
          {tr("Find an activity")}
          <ArrowUpRight size={14} />
        </Link>
      </section>
    </main>
  );
}
