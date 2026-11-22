import { useEffect, useState } from "react";

/**
 * Season visuals with slots for licensed assets.
 * Drop files into web/public/season/ and they appear automatically:
 *   logo.png     — the team logo (shown next to the season title)
 *   players.jpg  — a players photo (replaces the drawn hockey scene)
 * Until then the drawn scene below is shown and the logo spot stays empty.
 */
export const SEASON_LOGO = "/season/logo.png";
export const SEASON_PHOTO = "/season/players.jpg";

/** True once the file at `src` has loaded in the browser (checked after hydration). */
function useAsset(src: string): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setOk(true);
    img.onerror = () => alive && setOk(false);
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return ok;
}

export function SeasonLogo({ alt }: { alt: string }) {
  const ok = useAsset(SEASON_LOGO);
  return ok ? <img className="season-logo" src={SEASON_LOGO} alt={alt} /> : null;
}

export function SeasonPicture({ alt }: { alt: string }) {
  const ok = useAsset(SEASON_PHOTO);
  return (
    <div className="season-picture">
      {ok ? <img src={SEASON_PHOTO} alt={alt} /> : <HockeyScene />}
    </div>
  );
}

/** An original drawn hockey scene: rink lines, crossed sticks, a puck and a net. */
function HockeyScene() {
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label="Hockey sticks, a puck and a net on the ice">
      <defs>
        <linearGradient id="ice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f7fb" />
          <stop offset="1" stopColor="#d6e6f0" />
        </linearGradient>
      </defs>
      <rect
        x="6"
        y="6"
        width="308"
        height="188"
        rx="60"
        fill="url(#ice)"
        stroke="#192168"
        strokeWidth="4"
      />
      <line x1="160" y1="8" x2="160" y2="192" stroke="#af1e2d" strokeWidth="5" />
      <line x1="92" y1="8" x2="92" y2="192" stroke="#192168" strokeWidth="4" opacity="0.7" />
      <line x1="228" y1="8" x2="228" y2="192" stroke="#192168" strokeWidth="4" opacity="0.7" />
      <circle cx="160" cy="100" r="30" fill="none" stroke="#192168" strokeWidth="3" />
      <circle cx="160" cy="100" r="4" fill="#192168" />
      {/* Net */}
      <g transform="translate(262 78)">
        <path
          d="M0 0 h26 a6 6 0 0 1 6 6 v32 a6 6 0 0 1 -6 6 h-26"
          fill="none"
          stroke="#af1e2d"
          strokeWidth="4"
        />
        <path
          d="M6 4 v36 M12 4 v36 M18 4 v36 M24 4 v36 M2 14 h28 M2 24 h28 M2 34 h28"
          stroke="#9aa5b1"
          strokeWidth="1.2"
        />
      </g>
      {/* Crossed sticks */}
      <g strokeLinecap="round">
        <path d="M64 46 L136 150" stroke="#7f5539" strokeWidth="8" />
        <path d="M136 150 q6 10 22 8" stroke="#111" strokeWidth="9" fill="none" />
        <path d="M128 46 L56 150" stroke="#a0785a" strokeWidth="8" />
        <path d="M56 150 q-6 10 -22 8" stroke="#111" strokeWidth="9" fill="none" />
        <path d="M70 55 l8 12 M122 55 l-8 12" stroke="#fff" strokeWidth="3" opacity="0.8" />
      </g>
      {/* Puck with a little motion */}
      <g transform="translate(214 132)">
        <path
          d="M-40 4 h22 M-36 12 h16 M-44 -4 h18"
          stroke="#192168"
          strokeWidth="3"
          opacity="0.35"
          strokeLinecap="round"
        />
        <ellipse cx="0" cy="6" rx="15" ry="6" fill="#111" />
        <rect x="-15" y="0" width="30" height="6" fill="#111" />
        <ellipse cx="0" cy="0" rx="15" ry="6" fill="#2b2b2b" />
      </g>
    </svg>
  );
}
