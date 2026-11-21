export function creditsFor(points: number, activityNiche: number) {
  return points * activityNiche;
}
export interface RewardItem {
  id: string;
  kind: "frame" | "badge" | "discount";
  name: string;
  description: string;
  cost: number;
  theme: string;
  merchant?: string;
  neighbourhood?: string;
  offer?: string;
  terms?: string;
  imageType?: string;
}
export interface CreditEntry {
  id: string;
  user_id: string;
  amount: number;
  label: string;
}
export interface RewardPurchase {
  user_id: string;
  item_id: string;
  code: string;
}
export const rewardCatalog: RewardItem[] = [
  {
    id: "frame-leaf",
    kind: "frame",
    name: "Forest frame",
    description: "A leafy green border for your profile avatar.",
    cost: 20,
    theme: "forest",
  },
  {
    id: "frame-sky",
    kind: "frame",
    name: "Sky frame",
    description: "A bright blue border for your profile avatar.",
    cost: 30,
    theme: "sky",
  },
  {
    id: "badge-explorer",
    kind: "badge",
    name: "Urban explorer",
    description: "A compass badge beside your name.",
    cost: 25,
    theme: "explorer",
  },
  {
    id: "badge-curious",
    kind: "badge",
    name: "Curiosity club",
    description: "A sparkle badge for your unexpected discoveries.",
    cost: 35,
    theme: "curious",
  },
  {
    id: "cafe-discount",
    kind: "discount",
    name: "A coffee after your walk",
    description: "A little café stop in the Plateau.",
    cost: 25,
    theme: "cafe",
    merchant: "Café des Balades",
    neighbourhood: "Plateau-Mont-Royal",
    offer: "15% off a drink",
    terms: "One drink per demo voucher. Cannot be combined with other offers.",
    imageType: "coffee",
  },
  {
    id: "resto-discount",
    kind: "discount",
    name: "Lunch with your people",
    description: "Keep the conversation going over lunch.",
    cost: 40,
    theme: "resto",
    merchant: "La Table du Quartier",
    neighbourhood: "Rosemont",
    offer: "20% off a meal",
    terms: "One meal per demo voucher. Drinks excluded. Cannot be combined with other offers.",
    imageType: "picnic",
  },
  {
    id: "bike-discount",
    kind: "discount",
    name: "A little bike tune-up",
    description: "Get ready for your next ride along the canal.",
    cost: 50,
    theme: "bike",
    merchant: "Atelier Vélo du Canal",
    neighbourhood: "Saint-Henri",
    offer: "$10 off a tune-up",
    terms: "One tune-up per demo voucher. Parts excluded. Cannot be combined with other offers.",
    imageType: "walk",
  },
];
