const SECRET_KEY_PATTERN =
  /(api[-_]?key|authorization|bearer|secret|private[-_]?key|seed|mnemonic|webhook[-_]?secret|access[-_]?token|refresh[-_]?token|id[-_]?token)/i;

export function redactString(value: string): string {
  if (value.length <= 12) return "[redacted]";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/mh_(test|live)_[a-zA-Z0-9]+/g, (match) => redactString(match))
    .replace(/(key_hash\"?\s*=\s*\$1[\s\S]*?params:\s*)[a-f0-9]{32,}/gi, "$1[redacted-hash]")
    .replace(/(params:\s*)[a-f0-9]{32,}(,\d+)/gi, "$1[redacted-hash]$2");
}

export function redactObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item)) as T;
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(key) && typeof nested === "string") {
        output[key] = redactString(nested);
      } else if (typeof nested === "string") {
        output[key] = redactSensitiveText(nested);
      } else {
        output[key] = redactObject(nested);
      }
    }
    return output as T;
  }

  return typeof value === "string" ? (redactSensitiveText(value) as T) : value;
}
