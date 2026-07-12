import { DIRECTOR_DEMO_PROFILES } from "./director-demo-seed.config";
import {
  buildResetOperations,
  generateDirectorDemoDataset,
  summarizeDataset,
} from "./director-demo-seed.fixtures";
import {
  assertDemoSeedAllowed,
  parseDirectorDemoSeedArgs,
} from "./director-demo-seed";

describe("director demo seed", () => {
  it("blocks production and requires the explicit demo seed flag", () => {
    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: "production",
        ALLOW_DEMO_SEED: "1",
      }),
    ).toThrow(/production/);

    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: "test",
        ALLOW_DEMO_SEED: undefined,
      }),
    ).toThrow(/ALLOW_DEMO_SEED=1/);

    expect(() =>
      assertDemoSeedAllowed({
        NODE_ENV: "test",
        ALLOW_DEMO_SEED: "1",
      }),
    ).not.toThrow();
  });

  it("parses dry-run/apply/reset-demo modes and profiles", () => {
    expect(parseDirectorDemoSeedArgs([])).toEqual({
      mode: "dry-run",
      profile: "medium",
      mongoUri: undefined,
    });
    expect(parseDirectorDemoSeedArgs(["--apply", "--profile", "small"])).toMatchObject({
      mode: "apply",
      profile: "small",
    });
    expect(parseDirectorDemoSeedArgs(["reset-demo", "--profile=large"])).toMatchObject({
      mode: "reset-demo",
      profile: "large",
    });
    expect(() => parseDirectorDemoSeedArgs(["--apply", "--dry-run"])).toThrow(
      /Choose only one/,
    );
  });

  it("generates deterministic fixture summaries", () => {
    const first = generateDirectorDemoDataset(DIRECTOR_DEMO_PROFILES.small);
    const second = generateDirectorDemoDataset(DIRECTOR_DEMO_PROFILES.small);

    expect(JSON.stringify(summarizeDataset(first))).toEqual(
      JSON.stringify(summarizeDataset(second)),
    );
    expect(first.collections[0].docs[0]._id.toHexString()).toEqual(
      second.collections[0].docs[0]._id.toHexString(),
    );
    expect(first.counts.ordertest2_docs).toBe(DIRECTOR_DEMO_PROFILES.small.salesOrders);
    expect(first.counts.anomalies_created).toBeGreaterThanOrEqual(10);
  });

  it("builds reset operations from id allowlists only", () => {
    const dataset = generateDirectorDemoDataset(DIRECTOR_DEMO_PROFILES.small);
    const operations = buildResetOperations(dataset);

    expect(operations.length).toBe(dataset.collections.length);
    for (const operation of operations) {
      expect(Object.keys(operation.filter)).toEqual(["_id"]);
      expect(Array.isArray(operation.filter._id.$in)).toBe(true);
      expect(operation.filter._id.$in.length).toBeGreaterThan(0);
    }
  });

  it("large reset allowlist covers ids produced by smaller profiles", () => {
    const small = generateDirectorDemoDataset(DIRECTOR_DEMO_PROFILES.small);
    const large = generateDirectorDemoDataset(DIRECTOR_DEMO_PROFILES.large);
    const largeIdsByCollection = new Map(
      large.collections.map((entry) => [
        entry.collection,
        new Set(entry.docs.map((doc) => doc._id.toHexString())),
      ]),
    );

    for (const entry of small.collections) {
      const largeIds = largeIdsByCollection.get(entry.collection);
      expect(largeIds).toBeDefined();
      for (const doc of entry.docs) {
        expect(largeIds.has(doc._id.toHexString())).toBe(true);
      }
    }
  });
});
