import { useLanguage } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Swords, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { questPoints, type QuestDraft } from "@/lib/types";
import * as api from "@/api";

const MAX_QUESTS = 5;

/**
 * Side quests for an activity: pick suggestions (for this activity type, or general ones)
 * or write your own. Up to 5; each is worth 5 × the activity's niche value, and the
 * creator validates them for attendees on the activity page.
 */
export function QuestEditor({
  typeId,
  nicheValue,
  value,
  onChange,
}: {
  typeId: string;
  nicheValue: number;
  value: QuestDraft[];
  onChange: (quests: QuestDraft[]) => void;
}) {
  const { tr } = useLanguage();
  const templates = useQuery({ queryKey: ["quest-templates"], queryFn: api.getQuestTemplates });
  const [own, setOwn] = useState("");
  const full = value.length >= MAX_QUESTS;
  const taken = new Set(value.map((q) => q.title.trim().toLowerCase()));
  const suggestions = (templates.data ?? [])
    .filter(
      (t) => (t.type_id === typeId || t.type_id === null) && !taken.has(t.title.toLowerCase()),
    )
    // This activity's own suggestions first.
    .sort((a, b) => Number(b.type_id === typeId) - Number(a.type_id === typeId));

  const addOwn = () => {
    const title = own.trim();
    if (title.length < 3 || full || taken.has(title.toLowerCase())) return;
    onChange([...value, { title, template_id: null }]);
    setOwn("");
  };

  return (
    <div className="quest-editor">
      <p className="quest-hint">
        {tr("Optional mini-challenges. Each is worth")}{" "}
        <strong>
          +{questPoints(nicheValue)} {tr("pts")}
        </strong>
        {", "}
        {tr("and you validate them for attendees once the activity starts.")}
      </p>

      {value.length > 0 && (
        <ol className="quest-list">
          {value.map((q, i) => (
            <li key={`${q.title}-${i}`}>
              <Swords size={15} aria-hidden="true" />
              <span>{tr(q.title)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${tr("Remove")} ${q.title}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ol>
      )}

      {!full && suggestions.length > 0 && (
        <div className="quest-suggestions" aria-label={tr("Suggestions")}>
          {suggestions.slice(0, 6).map((t) => (
            <button
              type="button"
              key={t.id}
              className="quest-chip"
              data-own-type={t.type_id === typeId}
              onClick={() => onChange([...value, { title: t.title, template_id: t.id }])}
            >
              <Plus size={13} /> {tr(t.title)}
            </button>
          ))}
        </div>
      )}

      {full ? (
        <p className="quest-hint">{tr("That's the maximum of 5 side quests.")}</p>
      ) : (
        <div className="quest-own">
          <input
            value={own}
            maxLength={80}
            onChange={(e) => setOwn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOwn();
              }
            }}
            placeholder={tr("Write your own side quest")}
            aria-label={tr("Write your own side quest")}
          />
          <Button type="button" variant="outline" onClick={addOwn} disabled={own.trim().length < 3}>
            <Plus /> {tr("Add")}
          </Button>
        </div>
      )}
    </div>
  );
}
