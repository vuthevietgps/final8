import "dotenv/config";
import mongoose, { Connection } from "mongoose";
import {
  DIRECTOR_DEMO_PROFILES,
  resolveDemoProfile,
} from "./director-demo-seed.config";
import {
  buildResetOperations,
  generateDirectorDemoDataset,
  summarizeDataset,
} from "./director-demo-seed.fixtures";
import {
  DemoCollectionDocs,
  DirectorDemoSeedCliOptions,
  DirectorDemoSeedMode,
  DirectorDemoSeedProfile,
} from "./director-demo-seed.types";

const INSERT_CHUNK_SIZE = 1000;

interface RunResult {
  mode: DirectorDemoSeedMode;
  dryRun: boolean;
  resetFirst: boolean;
  profile: DirectorDemoSeedProfile;
  summary?: ReturnType<typeof summarizeDataset>;
  inserted?: Record<string, number>;
  deleted?: Record<string, number>;
}

export function assertDemoSeedAllowed(
  env: Record<"NODE_ENV" | "ALLOW_DEMO_SEED", string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_DEMO_SEED: process.env.ALLOW_DEMO_SEED,
  },
) {
  if (env.NODE_ENV === "production") {
    throw new Error("Director demo seed is disabled when NODE_ENV=production");
  }

  if (env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Director demo seed requires ALLOW_DEMO_SEED=1");
  }
}

export function parseDirectorDemoSeedArgs(
  argv: string[],
): DirectorDemoSeedCliOptions {
  let mode: DirectorDemoSeedMode = "dry-run";
  let profile: DirectorDemoSeedProfile = "medium";
  let mongoUri: string | undefined;
  let explicitMode: DirectorDemoSeedMode | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--dry-run" || arg === "dry-run") {
      explicitMode = setMode(explicitMode, "dry-run");
      mode = "dry-run";
      continue;
    }

    if (arg === "--apply" || arg === "apply") {
      explicitMode = setMode(explicitMode, "apply");
      mode = "apply";
      continue;
    }

    if (arg === "--reset-demo" || arg === "reset-demo") {
      explicitMode = setMode(explicitMode, "reset-demo");
      mode = "reset-demo";
      continue;
    }

    if (arg === "--profile") {
      profile = parseProfile(next);
      index += 1;
      continue;
    }

    if (arg.startsWith("--profile=")) {
      profile = parseProfile(arg.slice("--profile=".length));
      continue;
    }

    if (arg === "--mongo-uri") {
      mongoUri = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--mongo-uri=")) {
      mongoUri = arg.slice("--mongo-uri=".length);
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      throw new Error(usage());
    }

    throw new Error(`Unsupported director demo seed argument: ${arg}`);
  }

  return { mode, profile, mongoUri };
}

export async function runDirectorDemoSeed(
  options: DirectorDemoSeedCliOptions,
): Promise<RunResult> {
  assertDemoSeedAllowed();

  const selectedProfile = resolveDemoProfile(options.profile);
  const dataset = generateDirectorDemoDataset(selectedProfile);

  if (options.mode === "dry-run") {
    return {
      mode: options.mode,
      dryRun: true,
      resetFirst: false,
      profile: selectedProfile.profile,
      summary: summarizeDataset(dataset),
    };
  }

  const mongoUri = options.mongoUri || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is required for apply/reset-demo. Dry-run does not require a database.",
    );
  }

  const connection = await mongoose.createConnection(mongoUri).asPromise();
  try {
    const resetDataset = generateDirectorDemoDataset(
      DIRECTOR_DEMO_PROFILES.large,
    );
    const deleted = await resetDemoDocuments(connection, resetDataset.collections);

    if (options.mode === "reset-demo") {
      return {
        mode: options.mode,
        dryRun: false,
        resetFirst: true,
        profile: selectedProfile.profile,
        deleted,
      };
    }

    const inserted = await insertDataset(connection, dataset.collections);
    return {
      mode: options.mode,
      dryRun: false,
      resetFirst: true,
      profile: selectedProfile.profile,
      summary: summarizeDataset(dataset),
      inserted,
      deleted,
    };
  } finally {
    await connection.close();
  }
}

async function insertDataset(
  connection: Connection,
  collections: DemoCollectionDocs[],
) {
  const inserted: Record<string, number> = {};

  for (const entry of collections) {
    inserted[entry.collection] = 0;
    for (let index = 0; index < entry.docs.length; index += INSERT_CHUNK_SIZE) {
      const chunk = entry.docs.slice(index, index + INSERT_CHUNK_SIZE);
      if (chunk.length === 0) {
        continue;
      }
      await connection.collection(entry.collection).insertMany(chunk, {
        ordered: true,
      });
      inserted[entry.collection] += chunk.length;
    }
  }

  return inserted;
}

async function resetDemoDocuments(
  connection: Connection,
  collections: DemoCollectionDocs[],
) {
  const deleted: Record<string, number> = {};

  for (const operation of buildResetOperations({
    batchId: "reset-demo",
    prefix: "reset-demo",
    profile: "large",
    generatedAt: new Date(0).toISOString(),
    reportDate: "reset-demo",
    collections,
    counts: {},
    anomalies: [],
  })) {
    const ids = operation.filter?._id?.$in || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error(
        `Unsafe reset operation for ${operation.collection}: missing _id allowlist`,
      );
    }

    const result = await connection
      .collection(operation.collection)
      .deleteMany(operation.filter);
    deleted[operation.collection] = result.deletedCount || 0;
  }

  return deleted;
}

function setMode(
  current: DirectorDemoSeedMode | undefined,
  next: DirectorDemoSeedMode,
) {
  if (current && current !== next) {
    throw new Error("Choose only one of --dry-run, --apply, or --reset-demo");
  }
  return next;
}

function parseProfile(value?: string): DirectorDemoSeedProfile {
  const resolved = resolveDemoProfile(value);
  return resolved.profile;
}

function usage() {
  return [
    "Usage:",
    "  npm run seed:ai-data-pack:director:demo -- --dry-run --profile small",
    "  npm run seed:ai-data-pack:director:demo -- --apply --profile medium",
    "  npm run seed:ai-data-pack:director:demo -- --reset-demo",
    "",
    "Requires NODE_ENV != production and ALLOW_DEMO_SEED=1.",
  ].join("\n");
}

async function main() {
  const options = parseDirectorDemoSeedArgs(process.argv.slice(2));
  const result = await runDirectorDemoSeed(options);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
