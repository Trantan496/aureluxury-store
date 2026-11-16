import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductRatingSummary } from "@/features/catalog/product-detail";

export interface AutoFiveStarState {
  enabled: boolean;
  updatedAt: string | null;
  updatedById: number | null;
}

const DEFAULT_STATE: AutoFiveStarState = {
  enabled: false,
  updatedAt: null,
  updatedById: null,
};

const DEFAULT_AUTO_RATING_FILE = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  ".data",
  "aurel-auto-rating.json",
);

/**
 * Resolves the effective product rating summary: real approved customer reviews
 * always take precedence; when none exist and admin auto-5-star is enabled,
 * returns a default 5-star summary.
 */
export function resolveProductRatingWithAuto(
  realSummary: ProductRatingSummary | null,
  autoState: Pick<AutoFiveStarState, "enabled">,
): ProductRatingSummary | null {
  if (realSummary && realSummary.count > 0) return realSummary;
  if (!autoState.enabled) return null;
  return { average: 5, count: 1 };
}

/**
 * File-backed store for the admin-managed default 5-star product rating toggle.
 */
export function createAutoRatingStore(storeFilePath = DEFAULT_AUTO_RATING_FILE) {
  let writeLock: Promise<void> = Promise.resolve();

  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = writeLock.then(task, task);
    writeLock = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function readState(): Promise<AutoFiveStarState> {
    try {
      const raw = await readFile(/* turbopackIgnore: true */ storeFilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AutoFiveStarState>;
      return {
        enabled: parsed?.enabled === true,
        updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null,
        updatedById: typeof parsed?.updatedById === "number" ? parsed.updatedById : null,
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  async function writeState(state: AutoFiveStarState): Promise<void> {
    const dir = path.dirname(storeFilePath);
    await mkdir(/* turbopackIgnore: true */ dir, { recursive: true });
    const tmpPath = `${storeFilePath}.${randomUUID()}.tmp`;
    await writeFile(/* turbopackIgnore: true */ tmpPath, JSON.stringify(state, null, 2), "utf8");
    await rename(/* turbopackIgnore: true */ tmpPath, /* turbopackIgnore: true */ storeFilePath);
  }

  return {
    async get(): Promise<AutoFiveStarState> {
      return readState();
    },

    async set(enabled: boolean, updatedById: number, now = new Date()): Promise<AutoFiveStarState> {
      return serialized(async () => {
        const next: AutoFiveStarState = {
          enabled,
          updatedAt: now.toISOString(),
          updatedById,
        };
        await writeState(next);
        return next;
      });
    },
  };
}

export const defaultAutoRatingStore = createAutoRatingStore();
