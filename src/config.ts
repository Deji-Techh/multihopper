import { config as loadDotenv } from "dotenv";
import { redactString } from "./redact.js";

loadDotenv();

export const DEVNET_API_BASE = "https://devnet.multihopper.com/api/v1";
export const PRODUCTION_API_BASE = "https://multihopper.com/api/v1";
export const DEVNET_RPC_URL = "https://api.devnet.solana.com";

export class SafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafetyError";
  }
}

export interface RuntimeConfig {
  baseUrl: string;
  apiKey?: string;
  rpcUrl: string;
  keypairPath?: string;
  allowLiveBroadcast: boolean;
  requestTimeoutMs: number;
}

export type SafetyMode = "http" | "broadcast";

function parseBool(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed === "https://devnet.multihopper.com") return DEVNET_API_BASE;
  if (trimmed === "https://multihopper.com") return PRODUCTION_API_BASE;
  return trimmed;
}

function isDevnetRpc(url: string): boolean {
  return /devnet/i.test(url);
}

function isMainnetRpc(url: string): boolean {
  return /mainnet|mainnet-beta/i.test(url);
}

export function loadConfig(): RuntimeConfig {
  const baseUrl = normalizeBaseUrl(process.env.MULTIHOPPER_BASE_URL ?? DEVNET_API_BASE);
  const apiKey = process.env.MULTIHOPPER_API_KEY ?? process.env.MH_API_KEY;
  const rpcUrl = process.env.SOLANA_RPC_URL ?? DEVNET_RPC_URL;
  const timeoutRaw = Number(process.env.REQUEST_TIMEOUT_MS ?? "20000");

  return {
    baseUrl,
    apiKey,
    rpcUrl,
    keypairPath: process.env.SOLANA_KEYPAIR_PATH,
    allowLiveBroadcast: parseBool(process.env.ALLOW_LIVE_BROADCAST),
    requestTimeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 20000,
  };
}

export function assertBountySafeConfig(config: RuntimeConfig, mode: SafetyMode): void {
  if (config.baseUrl !== DEVNET_API_BASE) {
    throw new SafetyError(
      `Refusing non-devnet MultiHopper API base URL: ${config.baseUrl}. Expected ${DEVNET_API_BASE}.`,
    );
  }

  if (config.apiKey && !config.apiKey.startsWith("mh_test_")) {
    throw new SafetyError("Refusing API key that does not start with mh_test_.");
  }

  if (!isDevnetRpc(config.rpcUrl) || isMainnetRpc(config.rpcUrl)) {
    throw new SafetyError(`Refusing non-devnet Solana RPC URL: ${config.rpcUrl}.`);
  }

  if (mode === "broadcast" && !config.allowLiveBroadcast) {
    throw new SafetyError("Refusing live broadcast because ALLOW_LIVE_BROADCAST is not true.");
  }
}

export function describeConfig(config: RuntimeConfig): Record<string, unknown> {
  return {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey ? redactString(config.apiKey) : "(not set)",
    rpcUrl: config.rpcUrl,
    keypairPath: config.keypairPath ?? "(not set)",
    allowLiveBroadcast: config.allowLiveBroadcast,
    requestTimeoutMs: config.requestTimeoutMs,
  };
}
