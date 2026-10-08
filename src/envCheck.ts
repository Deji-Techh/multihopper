import { assertBountySafeConfig, describeConfig, loadConfig } from "./config.js";

const config = loadConfig();

console.log("Runtime config:");
console.log(JSON.stringify(describeConfig(config), null, 2));

assertBountySafeConfig(config, "http");
console.log("PASS bounty-safe HTTP configuration");

try {
  assertBountySafeConfig(config, "broadcast");
  console.log("PASS live broadcast is explicitly enabled and config is devnet-only");
} catch (error) {
  console.log(`INFO broadcast disabled: ${(error as Error).message}`);
}
