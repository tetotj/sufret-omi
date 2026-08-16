import { performance } from "node:perf_hooks";

const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 5000);
const stages = [
  { name: "smoke", concurrency: 1, requests: 20 },
  { name: "warm", concurrency: 10, requests: 100 },
  { name: "medium", concurrency: 50, requests: 500 },
  { name: "high", concurrency: 100, requests: 1000 },
];
const endpoints = [
  { name: "health", path: "/api/health", expected: [200] },
  { name: "auth-me-anonymous", path: "/api/auth/me", expected: [401] },
  { name: "marketing-announcements", path: "/api/trpc/marketing.announcements", expected: [200] },
  { name: "marketing-offers", path: "/api/trpc/marketing.offers", expected: [200] },
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
}

async function request(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${endpoint.path}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const latencyMs = performance.now() - started;
    const body = await response.text();
    return {
      endpoint: endpoint.name,
      status: response.status,
      ok: endpoint.expected.includes(response.status),
      latencyMs,
      bodyBytes: Buffer.byteLength(body),
    };
  } catch (error) {
    return {
      endpoint: endpoint.name,
      status: 0,
      ok: false,
      latencyMs: performance.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runStage(stage) {
  const jobs = Array.from({ length: stage.requests }, (_, index) => endpoints[index % endpoints.length]);
  const results = [];
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= jobs.length) return;
      results.push(await request(jobs[index]));
    }
  }
  await Promise.all(Array.from({ length: stage.concurrency }, worker));
  const latencies = results.map((result) => result.latencyMs);
  const failures = results.filter((result) => !result.ok);
  const byEndpoint = Object.fromEntries(endpoints.map((endpoint) => {
    const subset = results.filter((result) => result.endpoint === endpoint.name);
    return [endpoint.name, {
      requests: subset.length,
      failures: subset.filter((result) => !result.ok).length,
      p95Ms: Number(percentile(subset.map((result) => result.latencyMs), 0.95).toFixed(2)),
    }];
  }));
  return {
    name: stage.name,
    requests: results.length,
    concurrency: stage.concurrency,
    failures: failures.length,
    failureRate: Number((failures.length / results.length).toFixed(4)),
    avgMs: Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(2)),
    p50Ms: Number(percentile(latencies, 0.5).toFixed(2)),
    p95Ms: Number(percentile(latencies, 0.95).toFixed(2)),
    p99Ms: Number(percentile(latencies, 0.99).toFixed(2)),
    maxMs: Number(Math.max(...latencies).toFixed(2)),
    byEndpoint,
    sampleFailures: failures.slice(0, 5),
  };
}

const startedAt = new Date().toISOString();
const results = [];
for (const stage of stages) {
  results.push(await runStage(stage));
}
console.log(JSON.stringify({ baseUrl, startedAt, finishedAt: new Date().toISOString(), stages: results }, null, 2));
if (results.some((stage) => stage.failures > 0)) process.exitCode = 2;
