import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, [
    "--env-file=.env",
    "--env-file-if-exists=.env.local",
    "server/index.js",
  ], { stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    stdio: "inherit",
  }),
];

let stopping = false;

const stop = (exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exitCode = exitCode;
};

for (const child of children) {
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (!stopping && (code !== 0 || signal)) stop(code || 1);
  });
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
