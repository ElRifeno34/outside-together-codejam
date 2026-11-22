# Season assets

Files placed here show up on the Season pass page automatically (no code change):

| File | Shown as | Suggested size |
| --- | --- | --- |
| `logo.png` | Team logo next to the season title | 256 × 256, transparent background |
| `players.jpg` | Photo on the right of the season banner (replaces the drawn hockey scene) | 1200 × 800 |

Only add files you have the rights to use. The Montréal Canadiens name and logo are NHL
trademarks, and game photos and players' likenesses need a licence (club, NHL / NHLPA,
or the photo agency).

Player-style cosmetics (migration 022) use jersey numbers, not names. Once licensed, rename
them in one line each, e.g.:

```sql
update public.shop_items set name = '<Player> #14 jersey' where id = 'fr-jersey-14';
```
