// Self-contained Claude Code CLI engine for the hybrid benchmark. Per-call model
// + reasoning effort (the cascade switches models mid-run), prompt via stdin,
// subscription OAuth (strips ANTHROPIC_API_KEY), Windows .cmd shell handling,
// neutral cwd. No product imports — runs standalone under tsx.

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

export interface RunOpts {
  model?: string; // "haiku" | "sonnet" | "opus" | full id
  effort?: string; // "low" | "medium" | "high" | ...
  timeoutMs?: number;
}

export interface RunResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  durationMs: number | null;
}

const DEFAULT_TIMEOUT_MS = 240_000;

function bin(): string {
  return process.env.CLAUDE_CLI_PATH || "claude";
}

function buildArgs(o: RunOpts): string[] {
  const args = ["-p", "--output-format", "json"];
  if (o.model) args.push("--model", o.model);
  if (o.effort) args.push("--effort", o.effort);
  return args;
}

function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (process.env.CLAUDE_CLI_KEEP_API_KEY !== "1") {
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;
  }
  return env;
}

function spawnClaude(prompt: string, args: string[], signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const b = bin();
    const child =
      process.platform === "win32"
        ? spawn((/\s/.test(b) ? `"${b}"` : b) + " " + args.join(" "), {
            env: childEnv(),
            cwd: tmpdir(),
            windowsHide: true,
            shell: true,
            signal,
          })
        : spawn(b, args, { env: childEnv(), cwd: tmpdir(), signal });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`claude CLI exited ${code}: ${stderr.trim().slice(0, 240) || "(no stderr)"}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

type Envelope = {
  result?: unknown;
  is_error?: boolean;
  error?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number };
  total_cost_usd?: number;
  duration_ms?: number;
};

export async function runClaude(prompt: string, o: RunOpts = {}): Promise<RunResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const raw = (await spawnClaude(prompt, buildArgs(o), controller.signal)).trim();
    let env: Envelope | null = null;
    try {
      env = JSON.parse(raw) as Envelope;
    } catch {
      return { text: raw, inputTokens: 0, outputTokens: 0, costUsd: null, durationMs: null };
    }
    if (env.is_error) {
      const msg = (typeof env.result === "string" && env.result) || (typeof env.error === "string" && env.error) || "Claude CLI error";
      throw new Error(msg);
    }
    return {
      text: typeof env.result === "string" ? env.result.trim() : raw,
      inputTokens: env.usage?.input_tokens ?? 0,
      outputTokens: env.usage?.output_tokens ?? 0,
      costUsd: typeof env.total_cost_usd === "number" ? env.total_cost_usd : null,
      durationMs: typeof env.duration_ms === "number" ? env.duration_ms : null,
    };
  } finally {
    clearTimeout(timer);
  }
}
