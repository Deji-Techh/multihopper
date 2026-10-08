import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface Candidate {
  id: string;
  severity: string;
  title: string;
  evidence: string[];
  proposedFix: string;
}

const localDocsRoot = "reports/private/docs";
const docsRoot =
  process.env.MULTIHOPPER_DOCS_ROOT ??
  (existsSync(join(localDocsRoot, "quickstart.md")) ? localDocsRoot : "/tmp/multihopper-docs");

function readDoc(relativePath: string): string {
  const fullPath = join(docsRoot, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing docs file: ${fullPath}. Fetch docs first or set MULTIHOPPER_DOCS_ROOT.`);
  }
  return readFileSync(fullPath, "utf8");
}

function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  if (start < 0) return "";
  const next = markdown.indexOf("\n## ", start + heading.length);
  return markdown.slice(start, next < 0 ? undefined : next);
}

function includesAll(haystack: string, needles: string[]): boolean {
  return needles.every((needle) => haystack.includes(needle));
}

const candidates: Candidate[] = [];
const quickstart = readDoc("quickstart.md");
const agentic = readDoc("guides/agentic-integration.md");
const estimateDoc = readDoc("api-reference/transfers/estimate.md");
const webhookEvents = readDoc("api-reference/webhooks/events.md");
const webhookDeleteDoc = readDoc("api-reference/webhooks/delete.md");
const webhookListDoc = readDoc("api-reference/webhooks/list.md");
const openApi = JSON.parse(readDoc("openapi.json")) as { paths: Record<string, unknown> };

const createStep = section(quickstart, "## Step 2: Create the transfer");
const prepareStep = section(quickstart, "## Step 3: Prepare transactions");
const confirmStep = section(quickstart, "## Step 4: Confirm broadcast");

const missingQuickstartIdempotency: string[] = [];
if (!createStep.includes("Idempotency-Key")) missingQuickstartIdempotency.push("Step 2 create transfer");
if (!prepareStep.includes("Idempotency-Key")) missingQuickstartIdempotency.push("Step 3 prepare transactions");
if (!confirmStep.includes("Idempotency-Key")) missingQuickstartIdempotency.push("Step 4 confirm broadcast");

if (missingQuickstartIdempotency.length > 0) {
  candidates.push({
    id: "MH-DOC-001",
    severity: "Documentation blocker",
    title: "Quickstart mutating POST examples omit required Idempotency-Key headers",
    evidence: missingQuickstartIdempotency,
    proposedFix: "Add Idempotency-Key to every mutating POST cURL example in Quickstart.",
  });
}

if (!includesAll(confirmStep, ["routeInitSignatures", "orchestratorInitSignature", "sessionInitSignatures", "keeperFundingSignature"]) || !confirmStep.includes("routeInitSignatures\": []")) {
  candidates.push({
    id: "MH-DOC-001B",
    severity: "Documentation blocker",
    title: "Quickstart detailed confirm step does not show the intermediate keeper-funding confirm call",
    evidence: ["Step 4 shows a final all-signatures confirm body but not the immediate keeper-funding-only body."],
    proposedFix: "Split Step 4 into intermediate keeper funding confirmation and final confirmation.",
  });
}

if (agentic.includes('const API_BASE = "https://multihopper.com";')) {
  candidates.push({
    id: "MH-DOC-002",
    severity: "High / Documentation blocker",
    title: "Agentic autonomous TypeScript loop defaults to production host",
    evidence: ['Agentic guide contains: const API_BASE = "https://multihopper.com";'],
    proposedFix: "Default autonomous examples to devnet and make production an explicit override.",
  });
}

if (agentic.includes("REST API: https://multihopper.com/api/v1")) {
  candidates.push({
    id: "MH-DOC-002B",
    severity: "High / Documentation blocker",
    title: "Agent context block defaults agents to production REST API",
    evidence: ["Agent context file contains production REST API URL."],
    proposedFix: "Use devnet in the default agent context and document production as a deliberate change.",
  });
}

const hasReclaimRentPaths =
  "/transfers/{transferId}/reclaim-rent/prepare" in openApi.paths &&
  "/transfers/{transferId}/reclaim-rent/confirm" in openApi.paths;

if (hasReclaimRentPaths && !agentic.includes("reclaim-rent")) {
  candidates.push({
    id: "MH-DOC-003",
    severity: "Low / Documentation blocker",
    title: "Agent context omits reclaim-rent recovery tools exposed by OpenAPI",
    evidence: ["OpenAPI includes reclaim-rent prepare/confirm paths; agentic tool table only lists rescue tools."],
    proposedFix: "Add prepare_reclaim_rent and confirm_reclaim_rent tools to the agent context.",
  });
}

const mutationPathsThatNeedIdempotency = [
  "/transfers",
  "/transfers/{transferId}/prepare",
  "/transfers/{transferId}/confirm-broadcast",
  "/transfers/{transferId}/rescue/prepare",
  "/transfers/{transferId}/rescue/confirm",
  "/transfers/{transferId}/reclaim-rent/prepare",
  "/transfers/{transferId}/reclaim-rent/confirm",
  "/webhooks",
];

const missingOpenApiIdempotency = mutationPathsThatNeedIdempotency.filter((path) => {
  const operation = (openApi.paths[path] as { post?: { parameters?: Array<{ name?: string; in?: string }> } } | undefined)?.post;
  return !operation?.parameters?.some((parameter) => parameter.name === "Idempotency-Key" && parameter.in === "header");
});

if (missingOpenApiIdempotency.length > 0) {
  candidates.push({
    id: "MH-DOC-009",
    severity: "Documentation blocker",
    title: "OpenAPI omits required Idempotency-Key header on mutating POST operations",
    evidence: missingOpenApiIdempotency.map((path) => `${path} POST operation has no Idempotency-Key header parameter.`),
    proposedFix: "Add a reusable required Idempotency-Key header parameter to every mutating POST operation in OpenAPI.",
  });
}

const webhookDeleteOperation = (
  openApi.paths["/webhooks/{endpointId}"] as {
    delete?: { parameters?: Array<{ name?: string; in?: string }> };
  } | undefined
)?.delete;
const webhookDeleteHasOpenApiIdempotency = webhookDeleteOperation?.parameters?.some(
  (parameter) => parameter.name === "Idempotency-Key" && parameter.in === "header",
);

if (!webhookDeleteDoc.includes("Idempotency-Key") || !webhookDeleteHasOpenApiIdempotency) {
  candidates.push({
    id: "MH-DOC-013",
    severity: "Documentation blocker",
    title: "Webhook delete requires Idempotency-Key in live API but docs and OpenAPI omit it",
    evidence: [
      "Delete Webhook page does not mention Idempotency-Key.",
      "OpenAPI deleteWebhook operation has only the endpointId path parameter.",
      "Live DELETE /webhooks/{endpointId} without Idempotency-Key returns MH_070.",
    ],
    proposedFix:
      "Document the Idempotency-Key requirement on DELETE /webhooks/{endpointId} and add it to the OpenAPI operation.",
  });
}

const webhookListItemsProperties = (
  openApi.paths["/webhooks"] as {
    get?: {
      responses?: {
        "200"?: {
          content?: {
            "application/json"?: {
              schema?: {
                properties?: {
                  items?: { items?: { properties?: Record<string, unknown> } };
                };
              };
            };
          };
        };
      };
    };
  } | undefined
)?.get?.responses?.["200"]?.content?.["application/json"]?.schema?.properties?.items?.items?.properties;

if (webhookListItemsProperties?.secret && !webhookListDoc.includes('name="secret"')) {
  candidates.push({
    id: "MH-DOC-014",
    severity: "Documentation blocker",
    title: "OpenAPI listWebhooks response includes a secret field that human docs and live API omit",
    evidence: [
      "OpenAPI listWebhooks item schema includes `secret`.",
      "List Webhooks human docs omit `secret` from response fields and examples.",
      "Live GET /webhooks while a webhook was active returned no `secret` field.",
    ],
    proposedFix:
      "Remove `secret` from the listWebhooks response schema, or explicitly document that it is always omitted/null after creation.",
  });
}

const securitySchemes = (openApi as { components?: { securitySchemes?: Record<string, { type?: string; scheme?: string }> } })
  .components?.securitySchemes ?? {};
const hasBearerSecurityScheme = Object.values(securitySchemes).some(
  (scheme) => scheme.type === "http" && scheme.scheme === "bearer",
);

if (readDoc("api-reference/introduction.md").includes("Authorization: Bearer") && !hasBearerSecurityScheme) {
  candidates.push({
    id: "MH-DOC-012",
    severity: "Documentation blocker",
    title: "OpenAPI describes Bearer auth only in text but does not model an Authorization bearer scheme",
    evidence: [
      "API Introduction documents `Authorization: Bearer ...` as supported.",
      "OpenAPI defines only an `apiKey` security scheme for `x-api-key`; no `http` bearer scheme is present.",
    ],
    proposedFix:
      "Add an HTTP bearer security scheme and list it as an alternative to x-api-key in OpenAPI security requirements.",
  });
}

if (webhookEvents.includes(".update(payload)") && webhookEvents.includes("verifyWebhook(req.body, signature")) {
  candidates.push({
    id: "MH-DOC-010",
    severity: "Documentation blocker",
    title: "Webhook signature verification example hashes parsed req.body and can throw on malformed signatures",
    evidence: [
      "Webhook Events example hashes `payload` but handler passes `req.body`, which is commonly a parsed object rather than the raw request body.",
      "The example calls `crypto.timingSafeEqual` without checking that signature and expected digest buffers have equal length.",
    ],
    proposedFix: "Verify against the raw request body bytes/string and return false before timingSafeEqual when the signature is missing or has the wrong length.",
  });
}

const openApiEstimate = (
  openApi.paths["/transfers/estimate"] as {
    post?: {
      responses?: {
        "200"?: {
          content?: {
            "application/json"?: {
              schema?: { properties?: Record<string, unknown> };
            };
          };
        };
      };
    };
  }
)?.post?.responses?.["200"]?.content?.["application/json"]?.schema?.properties;

if (
  openApiEstimate?.sol &&
  openApiEstimate.tokens &&
  (!estimateDoc.includes('name="sol"') || !estimateDoc.includes('name="tokens"'))
) {
  candidates.push({
    id: "MH-DOC-011",
    severity: "Documentation blocker",
    title: "Estimate docs omit SOL budgeting fields while warning conflicts with live screening-fee output",
    evidence: [
      "OpenAPI response schema includes `tokens` and `sol`, but the human Estimate Fees page only documents top-level fee fields.",
      "Estimate page warns the estimate does not include the compliance screening fee, but live devnet responses include `sol.breakdown.screeningFeeLamports`.",
    ],
    proposedFix:
      "Document `tokens`, `sol`, `minTransferAmountLamports`, and `screeningFeeLamports`, and clarify whether screening deposit is included in estimate results per environment.",
  });
}

if (
  quickstart.includes("status` of `awaiting_signature`") &&
  agentic.includes('status: "awaiting_signature"') &&
  openApiText().includes("The transfer is in `quote` status")
) {
  candidates.push({
    id: "MH-DOC-004",
    severity: "Documentation blocker",
    title: "Create transfer initial status is documented inconsistently as quote and awaiting_signature",
    evidence: [
      "Quickstart says create returns status awaiting_signature.",
      "Agent context says create returns status awaiting_signature.",
      "OpenAPI/API reference says create returns status quote.",
    ],
    proposedFix: "Use one canonical initial status everywhere and tell agents which status should trigger prepare.",
  });
}

const preparedBundle = JSON.stringify((openApi as { components?: { schemas?: Record<string, unknown> } }).components?.schemas?.PreparedTxBundle ?? {});
if (
  preparedBundle.includes('"routeInitTxs"') &&
  !preparedBundle.includes('"routeInitTxs":{"type":"array","nullable":true') &&
  agentic.includes('"routeInitTxs": null')
) {
  candidates.push({
    id: "MH-DOC-005",
    severity: "Documentation blocker",
    title: "PreparedTxBundle nullability is inconsistent for resumed route/session arrays",
    evidence: [
      "Agentic resume example shows routeInitTxs: null.",
      "Prepare API reference describes routeInitTxs/sessionInitTxs as arrays, empty when already done.",
      "OpenAPI PreparedTxBundle marks keeperFundingTx/orchestratorInitTx nullable but not routeInitTxs/sessionInitTxs.",
    ],
    proposedFix: "Align OpenAPI and docs: either arrays are always arrays, or mark routeInitTxs/sessionInitTxs nullable and document both forms.",
  });
}

function openApiText(): string {
  return JSON.stringify(openApi);
}

console.log(`# Docs check against ${docsRoot}`);
for (const candidate of candidates) {
  console.log(`\n${candidate.id}: ${candidate.title}`);
  console.log(`Severity: ${candidate.severity}`);
  console.log("Evidence:");
  for (const item of candidate.evidence) console.log(`- ${item}`);
  console.log(`Proposed fix: ${candidate.proposedFix}`);
}

if (candidates.length === 0) {
  console.log("No documentation candidates detected by current checks.");
}
