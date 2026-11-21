import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Coins,
  Copy,
  Gift,
  Info,
  MapPin,
  Palette,
  Receipt,
  Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProfileAvatar, ProfileBadge } from "@/components/profile-identity";
import { activityImages } from "@/components/activity-card";
import { useApp } from "@/components/app-provider";
import { useLanguage } from "@/i18n";
import { type RewardItem } from "@/data/rewards";
import * as api from "@/api";
import { toast } from "sonner";
import "@/components/rewards.css";
const catalogOptions = queryOptions({
  queryKey: ["reward-catalog"],
  queryFn: api.getRewardCatalog,
});
export const Route = createFileRoute("/rewards")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogOptions),
  head: () => ({
    meta: [
      { title: "Credits & Montréal rewards · Outside Together" },
      {
        name: "description",
        content:
          "Earn activity credits, personalize your profile, and explore fictional Montréal café, restaurant and service offers.",
      },
      { property: "og:title", content: "Credits & Montréal rewards · Outside Together" },
      {
        property: "og:description",
        content:
          "Your outdoor activities unlock profile styles and demo local rewards, without spending ranking points.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RewardsPage,
});
function RewardsPage() {
  const { tr } = useLanguage();
  const { profile, openAuth, refreshProfile } = useApp();
  const { data: catalog } = useSuspenseQuery(catalogOptions);
  const wallet = useQuery({
    queryKey: ["wallet", profile?.id],
    queryFn: api.getMyWallet,
    enabled: !!profile,
  });
  const [tab, setTab] = useState("customize");
  const [selected, setSelected] = useState<RewardItem | null>(null);
  const [busy, setBusy] = useState(false);
  const balance = wallet.data?.balance ?? 0;
  const owned = (id: string) => wallet.data?.purchases.some((p) => p.item_id === id) ?? false;
  const equipped = (item: RewardItem) =>
    item.kind === "frame" ? profile?.avatar_frame === item.id : profile?.profile_badge === item.id;
  const equip = async (item: RewardItem) => {
    if (item.kind === "discount") return;
    setBusy(true);
    try {
      await api.equipReward(item.kind, equipped(item) ? null : item.id);
      await refreshProfile();
    } catch (err) {
      toast.error(tr(err instanceof Error ? err.message : "Please try again"));
    } finally {
      setBusy(false);
    }
  };
  const items = catalog.filter((item) =>
    tab === "customize"
      ? item.kind !== "discount"
      : tab === "offers"
        ? item.kind === "discount"
        : owned(item.id),
  );
  return (
    <main className="page-width">
      <section className="rewards-intro">
        <div>
          <div className="eyebrow">
            <Gift size={15} />
            {tr("Your hours, a little more rewarding")}
          </div>
          <h1>{tr("Credits & rewards")}</h1>
          <p>{tr("Keep your points. Spend your credits.")}</p>
        </div>
        <div className="credit-wallet">
          <Coins size={28} />
          <div>
            <strong aria-label={tr("Credit balance")}>
              {profile ? (wallet.isPending ? "…" : balance) : "—"}
            </strong>
            <span>{tr("available credits")}</span>
          </div>
        </div>
      </section>
      <div className="rewards-notice">
        <Info size={16} />
        <p>
          {tr(
            "Credits = earned points × activity niche level. Activities and bonus challenges both count.",
          )}{" "}
          {tr("Points stay in your rankings, even when you spend credits.")}
        </p>
      </div>
      {profile ? (
        <div className="rewards-account">
          <ProfileAvatar name={profile.display_name} frame={profile.avatar_frame} />
          <div>
            <h2>{profile.display_name}</h2>
            <ProfileBadge badge={profile.profile_badge} />
            <p>
              {profile.total_points} {tr("total points")}
            </p>
          </div>
          <Button variant="link" asChild>
            <Link to="/profile">
              {tr("View my profile")}
              <ArrowUpRight />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rewards-account">
          <p>{tr("Sign in to earn credits and unlock rewards.")}</p>
          <Button onClick={() => openAuth()}>{tr("Sign in")}</Button>
        </div>
      )}
      {wallet.isError && (
        <p role="alert">
          {tr("Couldn’t load your credits.")}{" "}
          <Button variant="link" onClick={() => void wallet.refetch()}>
            {tr("Try again")}
          </Button>
        </p>
      )}
      <div className="reward-tabs" role="tablist" aria-label={tr("Reward categories")}>
        {[
          { id: "customize", label: "Personalize", Icon: Palette },
          { id: "offers", label: "Montréal offers", Icon: MapPin },
          { id: "collection", label: "My rewards", Icon: Ticket },
          { id: "history", label: "Credit history", Icon: Receipt },
        ].map(({ id, label, Icon }) => (
          <Button
            key={id}
            role="tab"
            aria-selected={tab === id}
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}
          >
            <Icon />
            {tr(label)}
          </Button>
        ))}
      </div>
      {(tab === "offers" || tab === "collection") && (
        <div className="rewards-notice">
          <Info size={16} />
          <p>
            {tr(
              "Fictional businesses and offers · demonstration only. No real discounts or partner agreements. Demo vouchers cannot be used in-store.",
            )}
          </p>
        </div>
      )}
      {tab === "history" ? (
        <div className="reward-history">
          {wallet.data?.entries.length ? (
            [...wallet.data.entries].reverse().map((entry) => (
              <div key={entry.id} className="reward-history-row" data-spent={entry.amount < 0}>
                <span>{tr(entry.label)}</span>
                <strong>
                  {entry.amount > 0 ? "+" : ""}
                  {entry.amount} {tr("credits")}
                </strong>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <Coins />
              <p>{tr("Your earned and spent credits will appear here.")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="reward-grid">
          {items.map((item) => {
            const purchase = wallet.data?.purchases.find((p) => p.item_id === item.id);
            return (
              <article className="reward-item" key={item.id}>
                {item.kind === "discount" ? (
                  <img
                    className="reward-photo"
                    src={activityImages[item.imageType ?? "coffee"]}
                    alt={tr(item.name)}
                  />
                ) : (
                  <div className="reward-preview" data-theme={item.theme}>
                    {item.kind === "frame" ? (
                      <ProfileAvatar name={profile?.display_name ?? "O"} frame={item.id} />
                    ) : (
                      <ProfileBadge badge={item.id} />
                    )}
                  </div>
                )}
                <div className="reward-item-content">
                  <h2>{tr(item.kind === "discount" ? (item.merchant ?? item.name) : item.name)}</h2>
                  {item.neighbourhood && (
                    <span className="reward-location">
                      <MapPin size={13} />
                      {item.neighbourhood} · Montréal
                    </span>
                  )}
                  {item.offer && <p className="reward-offer">{tr(item.offer)}</p>}
                  <p>{tr(item.description)}</p>
                  {item.terms && (
                    <details className="mt-3 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">{tr("Offer terms")}</summary>
                      <p className="mt-2">{tr(item.terms)}</p>
                    </details>
                  )}
                  {purchase?.code && (
                    <>
                      <div className="reward-code">
                        <code>{purchase.code}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={tr("Copy demo code")}
                          aria-label={tr("Copy demo code")}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(purchase.code);
                              toast.success(tr("Demo code copied"));
                            } catch {
                              toast.error(tr("Could not copy the code"));
                            }
                          }}
                        >
                          <Copy />
                        </Button>
                      </div>
                      <p className="mt-2">{tr("Demo voucher · not valid in-store")}</p>
                    </>
                  )}
                  <div className="reward-item-footer">
                    <span className="reward-cost">
                      <Coins size={15} />
                      {item.cost} {tr("credits")}
                    </span>
                    {owned(item.id) ? (
                      item.kind === "discount" ? (
                        <span className="text-xs text-primary flex gap-1 items-center">
                          <Check size={14} />
                          {tr("In your collection")}
                        </span>
                      ) : (
                        <Button
                          variant={equipped(item) ? "secondary" : "outline"}
                          disabled={busy}
                          onClick={() => void equip(item)}
                        >
                          {equipped(item) ? (
                            <>
                              <Check />
                              {tr("Remove")}
                            </>
                          ) : (
                            tr("Apply")
                          )}
                        </Button>
                      )
                    ) : (
                      <Button
                        disabled={
                          !!profile && (wallet.isPending || wallet.isError || balance < item.cost)
                        }
                        onClick={() => (profile ? setSelected(item) : openAuth())}
                      >
                        {profile && balance < item.cost
                          ? tr("Not enough credits")
                          : item.kind === "discount"
                            ? tr("Get demo offer")
                            : tr("Unlock")}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {items.length === 0 && (
            <div className="empty-state">
              <Gift />
              <p>{tr("Your unlocked styles and demo vouchers will appear here.")}</p>
            </div>
          )}
        </div>
      )}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{selected && tr(selected.name)}</DialogTitle>
          <DialogDescription>
            {tr("Spend credits to unlock this reward? Your ranking points will not change.")}
          </DialogDescription>
          {selected && (
            <>
              <p className="reward-cost">
                <Coins />
                {selected.cost} {tr("credits")} · {balance - selected.cost}{" "}
                {tr("credits remaining")}
              </p>
              {selected.kind === "discount" && (
                <p className="text-xs text-muted-foreground">
                  {tr("Demo voucher · not valid in-store")}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setSelected(null)}>
                  {tr("Cancel")}
                </Button>
                <Button
                  disabled={busy || balance < selected.cost}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.purchaseReward(selected.id);
                      await refreshProfile();
                      setSelected(null);
                      toast.success(tr("Reward unlocked"));
                    } catch (err) {
                      toast.error(tr(err instanceof Error ? err.message : "Please try again"));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? tr("One moment…") : tr("Confirm purchase")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
