import { useLanguage } from "@/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Coins, Lock, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app-provider";
import { DisplayName, GradeBadge, ProfileAvatar } from "@/components/profile-bits";
import { BANNERS, ITEM_KIND_LABEL, POINTS_PER_CREDIT, type ItemKind } from "@/lib/progression";
import type { PublicProfile, ShopItem } from "@/lib/types";
import * as api from "@/api";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop · Outside Together" },
      {
        name: "description",
        content: "Spend your credits on profile pictures, frames, banners and name effects.",
      },
    ],
  }),
  component: ShopPage,
});

const KINDS: ItemKind[] = ["avatar", "frame", "banner", "name_effect"];
const EQUIPPED_KEY: Record<ItemKind, keyof PublicProfile> = {
  avatar: "avatar_item",
  frame: "frame_item",
  banner: "banner_item",
  name_effect: "name_effect_item",
};

function ShopPage() {
  const { tr } = useLanguage();
  const { profile, openAuth } = useApp();
  const client = useQueryClient();
  const [kind, setKind] = useState<ItemKind>("avatar");
  const [preview, setPreview] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useQuery({ queryKey: ["shop-items"], queryFn: api.getShopItems });
  const progress = useQuery({
    queryKey: ["my-progress", profile?.id],
    queryFn: api.getMyProgress,
    enabled: !!profile,
  });
  const me = useQuery({
    queryKey: ["public-profile", profile?.id],
    queryFn: () => api.getPublicProfile(profile!.id),
    enabled: !!profile,
  });

  const owned = new Set(progress.data?.items ?? []);
  const credits = progress.data?.credits ?? 0;
  const equipped = (k: ItemKind) => (me.data?.[EQUIPPED_KEY[k]] as string | null) ?? null;
  // The preview card shows what you're hovering/selecting on top of what you wear.
  const look = (k: ItemKind) => (preview?.kind === k ? preview.id : equipped(k));

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["my-progress"] }),
      client.invalidateQueries({ queryKey: ["public-profile"] }),
      client.invalidateQueries({ queryKey: ["leaderboard"] }),
    ]);
  };

  const buy = async (item: ShopItem) => {
    if (!profile) return openAuth();
    setBusy(item.id);
    try {
      await api.buyItem(item.id);
      await api.equipItem(item.kind, item.id);
      toast.success(`${tr(item.name)} ${tr("is yours, and you're wearing it!")}`);
      await refresh();
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setBusy(null);
    }
  };

  const equip = async (item: ShopItem, on: boolean) => {
    setBusy(item.id);
    try {
      await api.equipItem(item.kind, on ? item.id : null);
      await refresh();
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setBusy(null);
    }
  };

  // Season-pass rewards are owned or not, but never sold.
  const list = (items.data ?? []).filter(
    (i) => i.kind === kind && (i.purchasable !== false || owned.has(i.id)),
  );
  const name = profile?.display_name ?? tr("You");

  return (
    <main className="page-width shop-page">
      <div className="page-title">
        <div className="eyebrow">
          <ShoppingBag size={15} /> {tr("Shop")}
        </div>
        <h1>{tr("Make your profile yours.")}</h1>
        <p>
          {tr("Every")} {POINTS_PER_CREDIT}{" "}
          {tr(
            "points you earn give 1 credit, and trophies give bonus credits. Points still count for rankings.",
          )}
        </p>
      </div>

      <div className="shop-layout">
        <aside className="shop-preview">
          <div className="pf-card">
            <div
              className="pf-banner"
              style={look("banner") ? { background: BANNERS[look("banner")!] } : undefined}
            />
            <div className="pf-card-body">
              <ProfileAvatar
                name={name}
                avatarItem={look("avatar")}
                frameItem={look("frame")}
                size={84}
              />
              <DisplayName name={name} effectItem={look("name_effect")} as="strong" />
              <GradeBadge points={profile?.total_points ?? 0} />
            </div>
          </div>
          {profile ? (
            <p className="shop-balance">
              <Coins size={18} /> <strong>{credits}</strong> {tr("credits")}
            </p>
          ) : (
            <Button onClick={() => openAuth()}>{tr("Sign in to shop")}</Button>
          )}
          {preview && (
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
              {tr("Stop previewing")}
            </Button>
          )}
        </aside>

        <section>
          <div className="shop-tabs" role="tablist" aria-label={tr("Shop")}>
            {KINDS.map((k) => (
              <Button
                key={k}
                role="tab"
                aria-selected={kind === k}
                variant="pill"
                data-active={kind === k}
                onClick={() => {
                  setKind(k);
                  setPreview(null);
                }}
              >
                {tr(ITEM_KIND_LABEL[k])}
              </Button>
            ))}
          </div>

          {items.isError ? (
            <div className="empty-state">
              <h2>{tr("The shop isn't set up yet.")}</h2>
              <p>{tr("Run migration 019 in Supabase, then reload.")}</p>
            </div>
          ) : (
            <div className="shop-grid">
              {list.map((item) => {
                const has = owned.has(item.id);
                const wearing = equipped(item.kind) === item.id;
                const short = Math.max(0, item.price - credits);
                return (
                  <article
                    key={item.id}
                    className="shop-item"
                    data-selected={preview?.id === item.id}
                    onMouseEnter={() => setPreview(item)}
                  >
                    <button
                      type="button"
                      className="shop-item-preview"
                      onClick={() => setPreview(item)}
                      aria-label={`${tr("Preview")} ${tr(item.name)}`}
                    >
                      <ItemPreview item={item} name={name} />
                    </button>
                    <div className="shop-item-body">
                      <strong>{tr(item.name)}</strong>
                      {has ? (
                        wearing ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() => void equip(item, false)}
                          >
                            <Check /> {tr("In use")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() => void equip(item, true)}
                          >
                            {tr("Use")}
                          </Button>
                        )
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy !== null || (!!profile && short > 0)}
                          onClick={() => void buy(item)}
                          title={short > 0 ? `${short} ${tr("more credits needed")}` : undefined}
                        >
                          {short > 0 && profile ? <Lock /> : <Coins />} {item.price}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {profile && (
            <p className="shop-earn">
              <Sparkles size={15} /> {tr("Earn more:")} <Link to="/">{tr("join activities")}</Link>,{" "}
              <Link to="/places">{tr("visit places")}</Link>, {tr("complete side quests and")}{" "}
              <Link to="/profile">{tr("unlock trophies")}</Link>.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/** How an item looks on its own card. */
function ItemPreview({ item, name }: { item: ShopItem; name: string }) {
  if (item.kind === "avatar") return <ProfileAvatar name={name} avatarItem={item.id} size={64} />;
  if (item.kind === "frame") return <ProfileAvatar name={name} frameItem={item.id} size={64} />;
  if (item.kind === "banner")
    return <span className="shop-banner-swatch" style={{ background: BANNERS[item.id] }} />;
  return <DisplayName name={name} effectItem={item.id} as="strong" />;
}
