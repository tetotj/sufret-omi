import { performance } from "node:perf_hooks";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const totalRequests = Number(process.env.SOAK_REQUESTS ?? 3000);
const concurrency = Number(process.env.SOAK_CONCURRENCY ?? 250);
const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 5000);
const paths = ["/api/health", "/api/auth/me", "/api/trpc/marketing.announcements", "/api/trpc/marketing.offers"];

const results = [];
let cursor = 0;
async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= totalRequests) return;
    const path = paths[index % paths.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal, headers: { Accept: "application/json" } });
      await response.arrayBuffer();
      results.push({ path, status: response.status, ok: [200, 401].includes(response.status), latencyMs: performance.now() - started });
    } catch (error) {
      results.push({ path, status: 0, ok: false, latencyMs: performance.now() - started, error: error instanceof Error ? error.message : String(error) });
    } finally {
      clearTimeout(timer);
    }
  }
}

const startedAt = new Date().toISOString();
await Promise.all(Array.from({ length: concurrency }, worker));
const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
const percentile = (p) => latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * p) - 1)] ?? 0;
const failures = results.filter((result) => !result.ok);
console.log(JSON.stringify({
  baseUrl,
  totalRequests,
  concurrency,
  startedAt,
  finishedAt: new Date().toISOString(),
  failures: failures.length,
  failureRate: Number((failures.length / results.length).toFixed(4)),
  avgMs: Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(2)),
  p50Ms: Number(percentile(0.5).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
  maxMs: Number(Math.max(...latencies).toFixed(2)),
  failuresSample: failures.slice(0, 10),
}, null, 2));
if (failures.length > 0) process.exitCode = 2;
