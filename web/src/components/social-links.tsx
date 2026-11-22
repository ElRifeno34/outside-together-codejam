import { useLanguage } from "@/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Github,
  Globe,
  Instagram,
  Linkedin,
  Music2,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SocialLinks, SocialNetwork } from "@/lib/types";
import * as api from "@/api";

const NETWORKS: { id: SocialNetwork; label: string; Icon: LucideIcon; placeholder: string }[] = [
  {
    id: "linkedin",
    label: "LinkedIn",
    Icon: Linkedin,
    placeholder: "https://www.linkedin.com/in/you",
  },
  {
    id: "instagram",
    label: "Instagram",
    Icon: Instagram,
    placeholder: "https://www.instagram.com/you",
  },
  { id: "tiktok", label: "TikTok", Icon: Music2, placeholder: "https://www.tiktok.com/@you" },
  { id: "x", label: "X", Icon: Twitter, placeholder: "https://x.com/you" },
  { id: "github", label: "GitHub", Icon: Github, placeholder: "https://github.com/you" },
  { id: "youtube", label: "YouTube", Icon: Youtube, placeholder: "https://www.youtube.com/@you" },
  { id: "website", label: "Website", Icon: Globe, placeholder: "https://your-site.com" },
];

/** Icons linking to someone's social profiles (opened in a new tab). */
export function SocialLinksRow({ links }: { links: SocialLinks }) {
  return (
    <div className="social-row">
      {NETWORKS.filter((n) => links[n.id]).map(({ id, label, Icon }) => (
        <a
          key={id}
          href={links[id]}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={label}
          title={label}
        >
          <Icon />
        </a>
      ))}
    </div>
  );
}

/** My social links: a small form, saved through set_social_links (https only). */
export function SocialLinksEditor({ current, userId }: { current: SocialLinks; userId: string }) {
  const { tr } = useLanguage();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SocialLinks>(current);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.setSocialLinks(draft);
      await client.invalidateQueries({ queryKey: ["public-profile", userId] });
      toast.success(tr("Links saved"));
      setOpen(false);
    } catch (e) {
      toast.error(tr(e instanceof Error ? e.message : "Please try again"));
    } finally {
      setSaving(false);
    }
  };

  if (!open)
    return (
      <div className="social-edit-closed">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Globe /> {tr(Object.keys(current).length ? "Edit my links" : "Add my social links")}
        </Button>
      </div>
    );

  return (
    <form
      className="social-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className="section-label">{tr("My links")}</h2>
      <div className="social-fields">
        {NETWORKS.map(({ id, label, Icon, placeholder }) => (
          <label key={id} className="social-field">
            <Icon aria-hidden="true" />
            <span className="sr-only">{label}</span>
            <input
              type="url"
              inputMode="url"
              value={draft[id] ?? ""}
              placeholder={placeholder}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, [id]: e.target.value })}
              aria-label={label}
            />
          </label>
        ))}
      </div>
      <div className="form-actions">
        <Button type="submit" disabled={saving}>
          {tr(saving ? "Saving…" : "Save links")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDraft(current);
            setOpen(false);
          }}
        >
          {tr("Cancel")}
        </Button>
      </div>
      <p className="pf-hint">
        {tr("Links are public on your profile. Leave a field empty to remove it.")}
      </p>
    </form>
  );
}
