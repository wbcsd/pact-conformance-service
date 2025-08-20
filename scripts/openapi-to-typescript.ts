#!/usr/bin/env node
/* eslint-disable no-console */
import { Command } from "commander";
import inquirer from "inquirer";
import * as fs from "node:fs";
import * as path from "node:path";
import * as cheerio from "cheerio";
import openapiTS, { astToString } from "openapi-typescript";

const DEFAULT_DOCS_URL =
  "https://docs.carbon-transparency.org/data-exchange-protocol/";
const DEFAULT_OUT_DIR = "schemas";

type OptionItem = {
  version: string; // e.g., "3.0.2"
  href: string; // absolute URL to the YAML
  label: string; // e.g., "PACT API v3.0.2"
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function extractSemver(text?: string | null): string | null {
  if (!text) return null;
  const m = text.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

/** From an <a> element, walk up/prev to find closest preceding <h2> that carries a version. */
function findNearestH2Version(
  $: cheerio.CheerioAPI,
  el: cheerio.Element
): string | null {
  // Move up to parent, then walk previous siblings
  let node: cheerio.Element | null = el.parent || null;
  while (node) {
    if ((node as any).tagName === "h2") {
      const ver = extractSemver($(node).text());
      if (ver) return ver;
      break;
    }
    node = (node as any).prev || null;
  }
  return null;
}

function labelForVersion(v: string): string {
  return `PACT API v${v}`;
}

/** 1.2.3 -> v1_2_schema.ts (drops patch) */
function filenameFromVersion(v: string): string {
  const [maj, min] = v.split(".");
  return `v${maj}_${min}_schema.ts`;
}

async function fetchWithRetry(
  url: string,
  opts: { retries?: number; delayMs?: number } = {}
): Promise<string> {
  const { retries = 2, delayMs = 500 } = opts;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < retries) await sleep(delayMs * (i + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function scrapeOptions(
  docsUrl: string,
  verbose = false
): Promise<OptionItem[]> {
  const html = await fetchWithRetry(docsUrl);
  const $ = cheerio.load(html);

  const optionsByVersion = new Map<string, OptionItem>();

  $("a").each((_, a) => {
    const $a = $(a);
    const text = $a.text().trim();
    const href = $a.attr("href");
    if (!href) return;

    const isYaml = /\.ya?ml(?:[?#].*)?$/i.test(href);
    const mentionsOpenAPI = /openapi/i.test(text);

    if (!isYaml || !mentionsOpenAPI) return;

    let version = extractSemver(text);
    if (!version) version = findNearestH2Version($ as any, a) || null;
    if (!version) {
      if (verbose)
        console.warn(`Skipping link without version: ${text} -> ${href}`);
      return;
    }

    const absolute = resolveUrl(href, docsUrl);
    if (!absolute) {
      if (verbose) console.warn(`Could not resolve URL: ${href}`);
      return;
    }

    if (!optionsByVersion.has(version)) {
      optionsByVersion.set(version, {
        version,
        href: absolute,
        label: labelForVersion(version),
      });
    }
  });

  const sorted = Array.from(optionsByVersion.values()).sort((a, b) => {
    const pa = a.version.split(".").map(Number);
    const pb = b.version.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if (pb[i] !== pa[i]) return pb[i] - pa[i];
    }
    return 0;
  });

  if (sorted.length === 0) {
    throw new Error("No OpenAPI YAML links found on the page.");
  }

  return sorted;
}

async function generateTypes(yaml: string): Promise<string> {
  // Get AST nodes
  const nodes = await openapiTS(yaml);
  return astToString(nodes);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

async function run(): Promise<void> {
  const program = new Command()
    .name("pact-openapi-gen")
    .description("Scrape PACT OpenAPI versions and generate TypeScript schemas")
    .option("-u, --url <url>", "Docs page URL", DEFAULT_DOCS_URL)
    .option(
      "-o, --out-dir <dir>",
      "Output directory for schemas",
      DEFAULT_OUT_DIR
    )
    .option("-l, --list", "List available versions and exit", false)
    .option("-v, --verbose", "Verbose logging", false)
    .showHelpAfterError();

  program.parse(process.argv);
  const opts = program.opts<{
    url: string;
    outDir: string;
    list?: boolean;
    verbose?: boolean;
  }>();

  const docsUrl = opts.url;
  const outDir = path.resolve(process.cwd(), opts.outDir);
  const verbose = Boolean(opts.verbose);
  const list = Boolean(opts.list);

  if (verbose) console.log(`Fetching docs from: ${docsUrl}`);

  let options: OptionItem[];
  try {
    options = await scrapeOptions(docsUrl, verbose);
  } catch (err) {
    console.error(`Error scraping options: ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  if (list) {
    console.log("Available versions:");
    for (const opt of options) {
      console.log(`- ${opt.label}  (${opt.href})`);
    }
    process.exit(0);
    return;
  }

  const answer = await inquirer.prompt<{ choice: OptionItem }>([
    {
      type: "list",
      name: "choice",
      message: "Select a PACT OpenAPI version:",
      choices: options.map((o) => ({ name: o.label, value: o })),
      pageSize: Math.min(options.length, 12),
    },
  ]);

  const { version, href } = answer.choice;
  if (verbose) console.log(`Selected ${version} -> ${href}`);

  let yaml: string;
  try {
    yaml = await fetchWithRetry(href, { retries: 2 });
  } catch (err) {
    console.error(
      `Failed to download YAML from ${href}\n${(err as Error).message}`
    );
    process.exit(1);
    return;
  }

  let ts: string;
  try {
    ts = await generateTypes(yaml);
  } catch (err) {
    console.error(
      `openapi-typescript failed to generate types: ${(err as Error).message}`
    );
    process.exit(1);
    return;
  }

  const filename = filenameFromVersion(version);
  ensureDir(outDir);
  const outPath = path.join(outDir, filename);

  try {
    fs.writeFileSync(outPath, ts, "utf8");
  } catch (err) {
    console.error(`Failed to write file ${outPath}: ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  console.log(
    `✅ Generated ${path.relative(process.cwd(), outPath)} from ${href}`
  );
  console.log(`   Version: ${version}  →  File: ${filename}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
