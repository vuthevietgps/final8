import { Inject, Injectable, Optional } from "@nestjs/common";
import { createHash } from "crypto";
import { createReadStream, ReadStream } from "fs";
import { mkdir, stat, writeFile } from "fs/promises";
import { resolve, sep } from "path";
import {
  AiDataPackExportFormat,
  AiDataPackExportMode,
  AiDataPackArtifactClass,
  AiDataPackArtifactRendering,
  AiDataPackRedactionProfile,
  AiDataPackRedactionRuntime,
  CachedExportPackType,
  ExportJobArtifactRecord,
} from "./export-job.types";

export const AI_DATA_PACK_EXPORT_ROOT = "AI_DATA_PACK_EXPORT_ROOT";

@Injectable()
export class ExportJobArtifactService {
  private readonly root: string;

  constructor(
    @Optional() @Inject(AI_DATA_PACK_EXPORT_ROOT) configuredRoot?: string,
  ) {
    this.root = resolve(
      configuredRoot ||
        process.env.AI_DATA_PACK_EXPORT_ROOT ||
        resolve(process.cwd(), "exports", "ai-data-pack"),
    );
  }

  async writeArtifact(params: {
    jobId: string;
    packType: CachedExportPackType;
    format: AiDataPackExportFormat;
    content: Buffer;
    dataContentChecksum?: string;
    cachedExport?: boolean;
    exportMode?: AiDataPackExportMode;
    redactionProfile?: AiDataPackRedactionProfile;
    sectionAccessProfile?: string;
    artifactClass?: AiDataPackArtifactClass;
    redactionRuntime?: AiDataPackRedactionRuntime;
    artifactRendering?: AiDataPackArtifactRendering;
    downloadReady?: boolean;
    checksumAlgorithm?: "sha256";
  }): Promise<ExportJobArtifactRecord> {
    const safeJobId = this.safeSegment(params.jobId);
    const fileName = `${this.safeSegment(params.packType)}.${params.format}`;
    const jobDirectory = this.safePath(safeJobId);
    const filePath = this.safePath(safeJobId, fileName);
    const artifactChecksum = createHash("sha256")
      .update(params.content)
      .digest("hex");
    const artifactId = createHash("sha256")
      .update(
        `${params.jobId}:${params.packType}:${params.format}:${artifactChecksum}`,
      )
      .digest("hex")
      .slice(0, 32);

    await mkdir(jobDirectory, { recursive: true });
    await writeFile(filePath, params.content, { flag: "wx" });

    return {
      artifactId,
      packType: params.packType,
      format: params.format,
      fileName,
      storageKey: `${safeJobId}/${fileName}`,
      artifactChecksum,
      dataContentChecksum: params.dataContentChecksum,
      fileSizeBytes: params.content.length,
      createdAt: new Date(),
      cachedExport: params.cachedExport ?? true,
      exportMode: params.exportMode,
      redactionProfile: params.redactionProfile,
      sectionAccessProfile: params.sectionAccessProfile,
      artifactClass: params.artifactClass,
      redactionRuntime: params.redactionRuntime,
      artifactRendering: params.artifactRendering,
      downloadReady: params.downloadReady,
      checksumAlgorithm: params.checksumAlgorithm,
    };
  }

  async verifyReadableArtifact(params: {
    storageKey: string;
    expectedChecksum: string;
    expectedSizeBytes: number;
  }): Promise<{
    stream: ReadStream;
    checksum: string;
    fileSizeBytes: number;
  }> {
    const filePath = this.safeStoragePath(params.storageKey);
    const metadata = await stat(filePath);
    if (!metadata.isFile()) {
      throw new Error("Artifact is unavailable.");
    }
    if (metadata.size !== params.expectedSizeBytes) {
      throw new Error("Artifact size mismatch.");
    }

    const checksum = await this.sha256File(filePath);
    if (checksum !== params.expectedChecksum) {
      throw new Error("Artifact checksum mismatch.");
    }

    return {
      stream: createReadStream(filePath),
      checksum,
      fileSizeBytes: metadata.size,
    };
  }

  private async sha256File(filePath: string): Promise<string> {
    return new Promise((resolveChecksum, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolveChecksum(hash.digest("hex")));
    });
  }

  private safeStoragePath(storageKey: string): string {
    const raw = String(storageKey || "").trim();
    const segments = raw.split(/[\\/]/);
    if (!raw || segments.some((segment) => !segment)) {
      throw new Error("Invalid artifact path segment.");
    }
    return this.safePath(...segments.map((segment) => this.safeSegment(segment)));
  }

  private safeSegment(value: string): string {
    const normalized = String(value || "").trim();
    if (
      !/^[a-zA-Z0-9._-]+$/.test(normalized) ||
      normalized === "." ||
      normalized === ".."
    ) {
      throw new Error("Invalid artifact path segment.");
    }
    return normalized;
  }

  private safePath(...segments: string[]): string {
    const target = resolve(this.root, ...segments);
    if (target !== this.root && !target.startsWith(`${this.root}${sep}`)) {
      throw new Error("Artifact path escapes the configured export root.");
    }
    return target;
  }
}
