import { normalizeSearchText } from "../catalog/search-ranking.ts";
import type { ChatMessage } from "./types.ts";

export type ChatRetrievalPlan = {
  category?: string;
  gender?: "men" | "women";
  keywords: string[];
  productIds?: string[];
  retrieve: boolean;
  showProducts: boolean;
};
type History = Pick<ChatMessage, "senderRole" | "content" | "suggestions">[];

const garments: [RegExp, string, string[]][] = [
  [/\b(trench|mang to)\b/, "outerwear", ["trench"]],
  [/\bblazer\b/, "outerwear", ["blazer"]],
  [/\bbomber\b/, "outerwear", ["bomber"]],
  [/\bvarsity\b/, "outerwear", ["varsity"]],
  [/\bwindbreaker\b/, "outerwear", ["windbreaker"]],
  [/\b(ao khoac|jacket|coat)\b/, "outerwear", []],
  [/\b(ao thun|t shirt|tee)\b/, "tops", ["t-shirt"]],
  [/\b(so mi|overshirt|shirt)\b/, "tops", ["shirt"]],
  [/\bpolo\b/, "tops", ["polo"]],
  [/\b(cardigan|ao len)\b/, "tops", ["cardigan"]],
  [/\b(jean|jeans)\b/, "bottoms", ["jean"]],
  [/\b(short|shorts)\b/, "bottoms", ["short"]],
  [/\b(quan|pants|trousers)\b/, "bottoms", []],
  [/\b(chan vay|skirt)\b/, "chan-vay", []],
  [/\b(dam|dress)\b/, "dam", []],
  [/\b(tui|bag|khan|scarf|phu kien)\b/, "accessories", []],
];
const genderOf = (text: string) => /\b(nu|women|woman|female)\b/.test(text) ? "women" as const
  : /\b(nam|men|man|male)\b/.test(text) ? "men" as const : undefined;
const garmentOf = (text: string) => garments.find(([pattern]) => pattern.test(text));

export function planChatRetrieval(message: string, history: History = []): ChatRetrievalPlan {
  const text = normalizeSearchText(message);
  const current = garmentOf(text);
  const previous = [...history].reverse().find(item => item.senderRole === "CUSTOMER" && garmentOf(normalizeSearchText(item.content)));
  const lastProducts = [...history].reverse().find(item => item.senderRole === "BOT" && item.suggestions?.length)?.suggestions;
  const followup = !current && /\b(mau do|mau nay|cai do|cai nay|ao do|size|kich co|mau sac|chat lieu|con hang|het hang|gia bao nhieu|that la|sao nay|ban bao|cho xem|xem them|mau khac)\b/.test(text);
  const detailOnly = /\b(size|kich co|chat lieu|bao quan|giat|doi tra|chinh sach)\b/.test(text);
  const garment = current ?? (followup && previous ? garmentOf(normalizeSearchText(previous.content)) : undefined);
  const inheritGender = !current || garment?.[1] === (previous && garmentOf(normalizeSearchText(previous.content))?.[1]);
  const gender = genderOf(text) ?? (inheritGender && previous ? genderOf(normalizeSearchText(previous.content)) : undefined);
  const keywords = [...(garment?.[2] ?? [])];
  keywords.push(...(text.match(/\b[a-z]*\d{2,}[a-z0-9]*\b/g) ?? []));
  if (/\b(black|den)\b/.test(text)) keywords.push("black");
  if (/\b(navy)\b/.test(text)) keywords.push("navy");
  const focused = !current && followup && !/\b(xem them|mau khac)\b/.test(text) ? lastProducts?.map(item => item.id) : undefined;
  return {
    category: garment?.[1], gender, keywords,
    ...(focused?.length ? { productIds: focused } : {}),
    retrieve: Boolean(current || (followup && (garment || focused?.length))),
    // Clarifications, greetings and policy/size answers do not repeat product cards.
    showProducts: Boolean(!detailOnly && (current || /\b(cho xem|xem them|mau khac)\b/.test(text))),
  };
}
