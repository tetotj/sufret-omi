import { spawn } from "node:child_process";

const children = new Map();
let stopping = false;

function start(name, args) {
  if (stopping) return;
  const child = spawn("pnpm", args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  children.set(name, child);
  child.on("exit", (code, signal) => {
    children.delete(name);
    if (stopping) return;
    console.error(`[dev] ${name} exited (${signal ?? code ?? "unknown"}); restarting in 1s`);
    setTimeout(() => start(name, args), 1000);
  });
  child.on("error", (error) => {
    console.error(`[dev] ${name} failed to start:`, error);
  });
}

function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children.values()) child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 1200).unref();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

start("api", ["dev:server"]);
start("metro", ["dev:metro"]);
