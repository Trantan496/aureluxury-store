import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractSearchIntent, normalizeSearchText } from "../catalog/search-ranking.ts";
import { formatSemicolonTags, parseSemicolonTags } from "./tag-parser.ts";

export { formatSemicolonTags, parseSemicolonTags };

type TagStoreData = {
  byProductId: Record<string, string[]>;
};

const DEFAULT_TAG_FILE = path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "aurel-product-tags.json");

export function createProductTagStore(storeFilePath = DEFAULT_TAG_FILE) {
  let writeLock: Promise<void> = Promise.resolve();

  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = writeLock.then(task, task);
    writeLock = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function readStore(): Promise<TagStoreData> {
    try {
      const raw = await readFile(/* turbopackIgnore: true */ storeFilePath, "utf8");
      const parsed = JSON.parse(raw) as TagStoreData;
      if (!parsed || typeof parsed.byProductId !== "object" || Array.isArray(parsed.byProductId)) {
        return { byProductId: {} };
      }
      return parsed;
    } catch {
      return { byProductId: {} };
    }
  }

  async function writeStore(data: TagStoreData): Promise<void> {
    await mkdir(/* turbopackIgnore: true */ path.dirname(storeFilePath), { recursive: true });
    const tempPath = `${storeFilePath}.${randomUUID()}.tmp`;
    await writeFile(/* turbopackIgnore: true */ tempPath, JSON.stringify(data, null, 2), "utf8");
    await rename(/* turbopackIgnore: true */ tempPath, storeFilePath);
  }

  return {
    async getTagsForProduct(productId: number | string): Promise<string[]> {
      const data = await readStore();
      return [...(data.byProductId[String(productId)] ?? [])];
    },

    async getTagsMapForProducts(productIds: readonly (number | string)[]): Promise<Record<string, string[]>> {
      const data = await readStore();
      const map: Record<string, string[]> = {};
      for (const id of productIds) {
        const key = String(id);
        map[key] = [...(data.byProductId[key] ?? [])];
      }
      return map;
    },

    async setTagsForProduct(productId: number | string, rawTags: unknown): Promise<string[]> {
      return serialized(async () => {
        const tags = parseSemicolonTags(rawTags);
        const data = await readStore();
        const key = String(productId);
        if (tags.length === 0) {
          delete data.byProductId[key];
        } else {
          data.byProductId[key] = tags;
        }
        await writeStore(data);
        return [...tags];
      });
    },

    async deleteTagsForProduct(productId: number | string): Promise<void> {
      return serialized(async () => {
        const data = await readStore();
        const key = String(productId);
        if (key in data.byProductId) {
          delete data.byProductId[key];
          await writeStore(data);
        }
      });
    },

    async findProductIdsMatchingQuery(rawQuery: string): Promise<number[]> {
      const { intentTokens, intentPhrase } = extractSearchIntent(rawQuery);
      if (!intentPhrase && intentTokens.length === 0) return [];

      const data = await readStore();
      const matched: number[] = [];

      for (const [idStr, tags] of Object.entries(data.byProductId)) {
        const idNum = Number(idStr);
        if (!Number.isInteger(idNum) || idNum <= 0 || !tags.length) continue;

        const normTags = tags.map(t => normalizeSearchText(t)).filter(Boolean);
        const joined = normTags.join(" ");

        const directPhraseMatch = normTags.some(
          t => t === intentPhrase || t.includes(intentPhrase) || (t.length >= 2 && intentPhrase.includes(t)),
        );
        const allTokensMatch =
          intentTokens.length > 0 && intentTokens.every(token => joined.includes(token));

        if (directPhraseMatch || allTokensMatch) {
          matched.push(idNum);
        }
      }

      return matched;
    },
  };
}

export const defaultProductTagStore = createProductTagStore();
