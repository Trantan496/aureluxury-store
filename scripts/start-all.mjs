import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
const localDbScript = path.join(rootDir, "scripts", "local-db.mjs");
const tryonDir = path.join(rootDir, "backend", "tryon-service");
const tryonPython = path.join(tryonDir, ".venv", "Scripts", "python.exe");
const tryonPort = Number(process.env.TRYON_PORT || "8001");

const extraArgs = process.argv.slice(2);
const spawnedChildren = [];
let shuttingDown = false;

function isPortListening(port, host = "127.0.0.1", timeoutMs = 800) {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    const done = result => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
  socket.once("error", () => done(false));
  });
}

async function waitForTryOnReady(port, maxWaitMs = 240_000) {
  const start = Date.now();
  const url = `http://127.0.0.1:${port}/health`;
  while (!shuttingDown && Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2000) });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === "ready") {
        console.log(`[start-all] CatVTON Try-On AI is ready & warmed up (${data.device || "GPU"}).`);
        return true;
      }
      if (data?.status === "unavailable") {
        console.warn(`[start-all] CatVTON Try-On AI unavailable: ${data.error || "unknown error"}`);
        return false;
      }
    } catch {
      // Service is still binding port or loading model
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.warn("[start-all] Timed out waiting for CatVTON Try-On AI warmup; continuing with Next.js startup.");
  return false;
}

async function prewarmTryOnInference(port) {
  const candidates = [
    path.join(rootDir, "public", "images", "aurel", "tryon-editorial-model.webp"),
    path.join(rootDir, "public", "images", "aurel", "aurel-edit-modern-gentleman.png"),
    path.join(rootDir, "public", "images", "image1.png"),
  ];
  const samplePath = candidates.find(p => existsSync(p));
  if (!samplePath) {
    console.warn("[start-all] No sample image found for CatVTON prewarm; skipping.");
    return;
  }

  console.log("[start-all] Running initial CatVTON /try-on prewarm request...");
  const startedAt = Date.now();
  try {
    const bytes = readFileSync(samplePath);
    const mime = samplePath.endsWith(".webp") ? "image/webp" : "image/png";
    const blob = new Blob([bytes], { type: mime });
    const form = new FormData();
    form.append("person_image", blob, path.basename(samplePath));
    form.append("garment_image", blob, path.basename(samplePath));
    form.append("cloth_type", "upper");

    const res = await fetch(`http://127.0.0.1:${port}/try-on`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (res.ok) {
      console.log(`[start-all] CatVTON prewarm inference completed in ${elapsed}s.`);
    } else {
      console.warn(`[start-all] CatVTON prewarm returned HTTP ${res.status} after ${elapsed}s.`);
    }
  } catch (err) {
    console.warn(`[start-all] CatVTON prewarm failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function runStep(label, command, args, cwd = rootDir) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", err => {
      console.warn(`[start-all] ${label} failed to launch: ${err.message}`);
      resolve(false);
    });
    child.once("exit", code => {
      if (code !== 0) {
        console.warn(`[start-all] ${label} exited with code ${code ?? "unknown"}.`);
      }
      resolve(code === 0);
    });
  });
}

function shutdown(signal = "SIGTERM", exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of spawnedChildren) {
    if (!child.killed) {
      try {
        child.kill(signal);
      } catch {
        // Ignore already-exited child processes
      }
    }
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
}

process.on("SIGINT", () => shutdown("SIGINT", 0));
process.on("SIGTERM", () => shutdown("SIGTERM", 0));

async function main() {
  if (existsSync(localDbScript)) {
    console.log("[start-all] Checking local PostgreSQL...");
    await runStep("PostgreSQL", process.execPath, [localDbScript, "start"]);
  }

  if (existsSync(tryonPython)) {
    const alreadyUp = await isPortListening(tryonPort);
    if (alreadyUp) {
      console.log(`[start-all] CatVTON Try-On service already listening on 127.0.0.1:${tryonPort}.`);
      const ready = await waitForTryOnReady(tryonPort);
      if (ready) {
        await prewarmTryOnInference(tryonPort);
      }
    } else {
      console.log(`[start-all] Starting CatVTON Try-On service on 127.0.0.1:${tryonPort}...`);
      const tryonChild = spawn(
        tryonPython,
        ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", String(tryonPort), "--workers", "1"],
        {
          cwd: tryonDir,
          stdio: "inherit",
          env: {
            ...process.env,
            CUPY_CACHE_DIR: path.join(tryonDir, ".cupy_cache"),
          },
        },
      );
      tryonChild.once("error", err => {
        console.warn(`[start-all] CatVTON Try-On failed to start: ${err.message}`);
      });
      spawnedChildren.push(tryonChild);
      console.log("[start-all] Waiting for CatVTON Try-On AI model load & warmup...");
      const ready = await waitForTryOnReady(tryonPort);
      if (ready) {
        await prewarmTryOnInference(tryonPort);
      }
    }
  } else {
    console.warn(`[start-all] CatVTON venv not found at ${tryonPython}; skipping local Try-On startup.`);
  }

  console.log("[start-all] Starting Next.js production server...");
  const nextChild = spawn(process.execPath, [nextBin, "start", ...extraArgs], {
    cwd: rootDir,
    stdio: "inherit",
  });
  spawnedChildren.push(nextChild);

  nextChild.once("exit", code => {
    shutdown("SIGTERM", code ?? 0);
  });
}

main().catch(err => {
  console.error("[start-all] Fatal startup error:", err);
  shutdown("SIGTERM", 1);
});
