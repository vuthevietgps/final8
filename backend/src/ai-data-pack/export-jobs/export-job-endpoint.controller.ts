import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { buildExportEndpointRequestContext } from "../audit/export-endpoint-request-context";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../auth/guards/auth.guard";
import { SecretRedactionInterceptor } from "../../common/interceptors/secret-redaction.interceptor";
import { AiDataPackExportRequester } from "./export-job.types";
import { ExportJobEndpointService } from "./export-job-endpoint.service";

@Controller("ai-data-pack/exports")
@UseGuards(JwtAuthGuard)
@UseInterceptors(SecretRedactionInterceptor)
export class ExportJobEndpointController {
  constructor(private readonly endpoints: ExportJobEndpointService) {}

  @Post()
  createExport(
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AiDataPackExportRequester,
    @Req() request: unknown,
  ): Promise<Record<string, unknown>> {
    return this.endpoints.createExport(
      body,
      user,
      buildExportEndpointRequestContext(request, "/ai-data-pack/exports", "POST"),
    );
  }

  @Get(":jobId/status")
  getStatus(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AiDataPackExportRequester,
    @Req() request: unknown,
  ): Promise<Record<string, unknown>> {
    return this.endpoints.getStatus(
      jobId,
      user,
      buildExportEndpointRequestContext(
        request,
        "/ai-data-pack/exports/:jobId/status",
        "GET",
      ),
    );
  }

  @Get(":jobId/sync-summary")
  getSyncSummary(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AiDataPackExportRequester,
    @Req() request: unknown,
  ): Promise<Record<string, unknown>> {
    return this.endpoints.getSyncSummary(
      jobId,
      user,
      buildExportEndpointRequestContext(
        request,
        "/ai-data-pack/exports/:jobId/sync-summary",
        "GET",
      ),
    );
  }

  @Get(":jobId/artifacts/:artifactId/download")
  async downloadArtifact(
    @Param("jobId") jobId: string,
    @Param("artifactId") artifactId: string,
    @CurrentUser() user: AiDataPackExportRequester,
    @Query() query: Record<string, unknown>,
    @Req() request: unknown,
    @Res() response: any,
  ): Promise<void> {
    const download = await this.endpoints.downloadArtifact(
      jobId,
      artifactId,
      user,
      query,
      buildExportEndpointRequestContext(
        request,
        "/ai-data-pack/exports/:jobId/artifacts/:artifactId/download",
        "GET",
      ),
    );

    response.setHeader("Content-Type", download.contentType);
    response.setHeader("Content-Length", String(download.fileSizeBytes));
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${download.fileName.replace(/["\\]/g, "_")}"`,
    );
    response.setHeader("ETag", `"sha256-${download.checksum}"`);
    response.setHeader("X-AI-Data-Pack-Checksum", download.checksum);
    response.setHeader("X-AI-Data-Pack-Job-Id", download.jobId);
    response.setHeader("X-AI-Data-Pack-Artifact-Id", download.artifactId);
    response.setHeader(
      "X-AI-Data-Pack-Redaction-Profile",
      download.redactionProfile,
    );
    response.setHeader("X-AI-Data-Pack-Manifest-Only", "false");

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (error?: unknown) => {
          if (settled) return;
          settled = true;
          if (error) reject(error);
          else resolve();
        };
        download.stream.on("error", (error) => {
          if (!response.headersSent) response.status(500);
          response.end();
          settle(error);
        });
        response.on("error", settle);
        response.on("finish", () => settle());
        download.stream.pipe(response);
      });
      await download.complete();
    } catch (error) {
      await download.fail(error);
      throw error;
    } finally {
      download.release();
    }
  }

  @Get(":jobId")
  getDetail(
    @Param("jobId") jobId: string,
    @CurrentUser() user: AiDataPackExportRequester,
    @Req() request: unknown,
  ): Promise<Record<string, unknown>> {
    return this.endpoints.getDetail(
      jobId,
      user,
      buildExportEndpointRequestContext(
        request,
        "/ai-data-pack/exports/:jobId",
        "GET",
      ),
    );
  }
}
