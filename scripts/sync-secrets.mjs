#!/usr/bin/env node
// Pushes values from .env (canonical app secrets) out to GitHub Actions
// (secrets + variables) and Render (service env vars), so both stay in sync
// with a single source of truth. Run locally only — see .env.example and
// .secrets-tokens.example for setup.
//
// Usage:
//   node scripts/sync-secrets.mjs           # push everything
//   node scripts/sync-secrets.mjs --dry-run # show what would change, no writes
//   node scripts/sync-secrets.mjs --deploy  # also trigger a Render redeploy after pushing

import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

// libsodium-wrappers' published ESM build is broken (missing a companion
// file) as of 0.7.x — load the CJS build via createRequire instead.
const sodium = createRequire(import.meta.url)("libsodium-wrappers");

const ROOT = path.resolve(import.meta.dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");
const TRIGGER_DEPLOY = process.argv.includes("--deploy");

// key -> which places it needs to be written to
const MANIFEST = {
  DATABASE_URL: ["render", "github-secret"],
  JWT_SECRET: ["render"],
  SUPER_ADMIN_USERNAME: ["render"],
  SUPER_ADMIN_PASSWORD: ["render"],
  SUPABASE_S3_ENDPOINT: ["render"],
  SUPABASE_S3_REGION: ["render"],
  SUPABASE_S3_ACCESS_KEY_ID: ["render"],
  SUPABASE_S3_SECRET_ACCESS_KEY: ["render"],
  SUPABASE_S3_BUCKET_NAME: ["render"],
  VITE_API_URL: ["github-variable"],
};

function parseDotenv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function loadEnvFile(filename) {
  const filePath = path.join(ROOT, filename);
  try {
    return parseDotenv(await readFile(filePath, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(`Missing ${filename} — copy ${filename}.example to ${filename} and fill it in.`);
      process.exit(1);
    }
    throw err;
  }
}

function mask(value) {
  if (!value) return "(empty)";
  if (value.length <= 8) return "*".repeat(value.length);
  return value.slice(0, 3) + "*".repeat(value.length - 6) + value.slice(-3);
}

function detectRepoFromGit() {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: ROOT })
      .toString()
      .trim();
    const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/);
    if (match) return { owner: match[1], repo: match[2] };
  } catch {
    // ignore, caller falls back to explicit config
  }
  return {};
}

async function githubRequest(token, method, urlPath, body) {
  const res = await fetch(`https://api.github.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function syncGithubSecrets(tokens, appEnv, keys) {
  if (keys.length === 0) return;
  const { owner, repo } = tokens;
  console.log(`\n--- GitHub secrets (${owner}/${repo}) ---`);

  if (DRY_RUN) {
    for (const key of keys) console.log(`  would set secret ${key} = ${mask(appEnv[key])}`);
    return;
  }

  const keyRes = await githubRequest(tokens.GH_TOKEN, "GET", `/repos/${owner}/${repo}/actions/secrets/public-key`);
  if (!keyRes.ok) throw new Error(`Failed to fetch repo public key: ${keyRes.status} ${await keyRes.text()}`);
  const { key, key_id } = await keyRes.json();

  await sodium.ready;
  const binKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);

  for (const secretKey of keys) {
    const value = appEnv[secretKey];
    if (!value) {
      console.log(`  skip ${secretKey} (no value in .env)`);
      continue;
    }
    const encryptedBytes = sodium.crypto_box_seal(sodium.from_string(value), binKey);
    const encrypted_value = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

    const res = await githubRequest(
      tokens.GH_TOKEN,
      "PUT",
      `/repos/${owner}/${repo}/actions/secrets/${secretKey}`,
      { encrypted_value, key_id },
    );
    if (!res.ok) throw new Error(`Failed to set secret ${secretKey}: ${res.status} ${await res.text()}`);
    console.log(`  set secret ${secretKey} = ${mask(value)}`);
  }
}

async function syncGithubVariables(tokens, appEnv, keys) {
  if (keys.length === 0) return;
  const { owner, repo } = tokens;
  console.log(`\n--- GitHub variables (${owner}/${repo}) ---`);

  for (const varKey of keys) {
    const value = appEnv[varKey];
    if (!value) {
      console.log(`  skip ${varKey} (no value in .env)`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  would set variable ${varKey} = ${value}`);
      continue;
    }

    const existing = await githubRequest(tokens.GH_TOKEN, "GET", `/repos/${owner}/${repo}/actions/variables/${varKey}`);
    let res;
    if (existing.status === 404) {
      res = await githubRequest(tokens.GH_TOKEN, "POST", `/repos/${owner}/${repo}/actions/variables`, {
        name: varKey,
        value,
      });
    } else {
      res = await githubRequest(tokens.GH_TOKEN, "PATCH", `/repos/${owner}/${repo}/actions/variables/${varKey}`, {
        name: varKey,
        value,
      });
    }
    if (!res.ok) throw new Error(`Failed to set variable ${varKey}: ${res.status} ${await res.text()}`);
    console.log(`  set variable ${varKey} = ${value}`);
  }
}

async function renderRequest(apiKey, method, urlPath, body) {
  const res = await fetch(`https://api.render.com/v1${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function resolveRenderServiceId(tokens) {
  if (tokens.RENDER_SERVICE_ID) return tokens.RENDER_SERVICE_ID;
  const res = await renderRequest(tokens.RENDER_API_KEY, "GET", "/services?name=postman-api&limit=5");
  if (!res.ok) throw new Error(`Failed to look up Render service: ${res.status} ${await res.text()}`);
  const list = await res.json();
  const first = list[0]?.service ?? list[0];
  if (!first?.id) {
    throw new Error(
      "Could not find a Render service named 'postman-api'. Set RENDER_SERVICE_ID explicitly in .secrets-tokens.",
    );
  }
  return first.id;
}

async function syncRender(tokens, appEnv, keys) {
  if (keys.length === 0) return;
  console.log(`\n--- Render env vars ---`);

  const serviceId = await resolveRenderServiceId(tokens);
  console.log(`  service: ${serviceId}`);

  const currentRes = await renderRequest(tokens.RENDER_API_KEY, "GET", `/services/${serviceId}/env-vars?limit=100`);
  if (!currentRes.ok) throw new Error(`Failed to fetch current Render env vars: ${currentRes.status} ${await currentRes.text()}`);
  const currentList = await currentRes.json();
  const merged = new Map();
  for (const item of currentList) {
    const envVar = item.envVar ?? item;
    if (envVar?.key) merged.set(envVar.key, envVar.value);
  }

  for (const key of keys) {
    const value = appEnv[key];
    if (!value) {
      console.log(`  skip ${key} (no value in .env)`);
      continue;
    }
    merged.set(key, value);
    console.log(`  set ${key} = ${mask(value)}`);
  }

  if (DRY_RUN) {
    console.log("  (dry run — not writing to Render)");
    return;
  }

  const body = Array.from(merged, ([key, value]) => ({ key, value }));
  const putRes = await renderRequest(tokens.RENDER_API_KEY, "PUT", `/services/${serviceId}/env-vars`, body);
  if (!putRes.ok) throw new Error(`Failed to update Render env vars: ${putRes.status} ${await putRes.text()}`);

  if (TRIGGER_DEPLOY) {
    const deployRes = await renderRequest(tokens.RENDER_API_KEY, "POST", `/services/${serviceId}/deploys`, {});
    if (!deployRes.ok) throw new Error(`Failed to trigger deploy: ${deployRes.status} ${await deployRes.text()}`);
    console.log("  triggered a new deploy to apply the changes");
  } else {
    console.log("  NOTE: Render env var changes only take effect on the next deploy.");
    console.log("        Re-run with --deploy, or redeploy manually from the Render dashboard.");
  }
}

async function main() {
  const appEnv = await loadEnvFile(".env");
  const tokenEnv = await loadEnvFile(".secrets-tokens");

  const detected = detectRepoFromGit();
  const tokens = {
    GH_TOKEN: tokenEnv.GH_TOKEN,
    RENDER_API_KEY: tokenEnv.RENDER_API_KEY,
    RENDER_SERVICE_ID: tokenEnv.RENDER_SERVICE_ID || undefined,
    owner: tokenEnv.GITHUB_OWNER || detected.owner,
    repo: tokenEnv.GITHUB_REPO || detected.repo,
  };

  const renderKeys = Object.keys(MANIFEST).filter((k) => MANIFEST[k].includes("render"));
  const githubSecretKeys = Object.keys(MANIFEST).filter((k) => MANIFEST[k].includes("github-secret"));
  const githubVariableKeys = Object.keys(MANIFEST).filter((k) => MANIFEST[k].includes("github-variable"));

  if (DRY_RUN) console.log("=== DRY RUN — no writes will be made ===");

  if (!tokens.GH_TOKEN) {
    console.log("\nGH_TOKEN not set in .secrets-tokens — skipping GitHub sync.");
  } else if (!tokens.owner || !tokens.repo) {
    console.log("\nCould not determine GitHub owner/repo — set GITHUB_OWNER/GITHUB_REPO in .secrets-tokens.");
  } else {
    await syncGithubSecrets(tokens, appEnv, githubSecretKeys);
    await syncGithubVariables(tokens, appEnv, githubVariableKeys);
  }

  if (!tokens.RENDER_API_KEY) {
    console.log("\nRENDER_API_KEY not set in .secrets-tokens — skipping Render sync.");
  } else {
    await syncRender(tokens, appEnv, renderKeys);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nsync-secrets failed:", err.message);
  process.exit(1);
});
