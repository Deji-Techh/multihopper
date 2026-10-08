import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const origin = "https://dev-docs.multihopper.com";
const outputRoot = process.env.MULTIHOPPER_DOCS_ROOT ?? "reports/private/docs";

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function sitemapUrls(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]!).filter((url) =>
    url.startsWith(origin),
  );
}

function docsPathFromUrl(url: string): string | null {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
  if (!path) return null;
  return `${path}.md`;
}

async function writeText(relativePath: string, text: string): Promise<void> {
  const outputPath = join(outputRoot, relativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, text, "utf8");
}

async function main(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });

  const [llms, sitemap, openApi] = await Promise.all([
    fetchText(`${origin}/llms.txt`),
    fetchText(`${origin}/sitemap.xml`),
    fetchText(`${origin}/api-reference/openapi.json`),
  ]);

  await writeText("llms.txt", llms);
  await writeText("sitemap.xml", sitemap);
  await writeText("openapi.json", openApi);

  const markdownPaths = sitemapUrls(sitemap).map(docsPathFromUrl).filter((path): path is string => Boolean(path));

  for (const markdownPath of markdownPaths) {
    const markdown = await fetchText(`${origin}/${markdownPath}`);
    await writeText(markdownPath, markdown);
    console.log(`saved ${markdownPath}`);
  }

  console.log(`Docs snapshot saved to ${outputRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
