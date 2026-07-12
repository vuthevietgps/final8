import {
  AI_DATA_PACK_EXPORT_DOWNLOAD_PERMISSION,
  AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
} from "../export-jobs/export-job.types";
import { ExportRedactionProfileService } from "../redaction/export-redaction-profile.service";
import { ExportRbacPolicyService } from "./export-rbac-policy.service";

function createService() {
  const profiles = new ExportRedactionProfileService();
  return new ExportRbacPolicyService(profiles);
}

describe("ExportRbacPolicyService", () => {
  it("allows official export only with create and profile permissions", () => {
    const service = createService();

    const decision = service.evaluateCreate({
      mode: "official_export",
      requester: {
        id: "director-1",
        permissions: [
          AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
          service.profilePermission("director_full"),
        ],
      },
      redactionProfile: "director_full",
      sectionAccessProfile: "director_full",
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies manager marketer requests for director_full without the director profile permission", () => {
    const service = createService();

    const decision = service.evaluateCreate({
      mode: "official_export",
      requester: {
        id: "manager-1",
        permissions: [
          AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
          service.profilePermission("manager_marketer"),
        ],
      },
      redactionProfile: "director_full",
      sectionAccessProfile: "director_full",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain(
      service.profilePermission("director_full"),
    );
  });

  it("fails closed when profile or section access profile is missing", () => {
    const service = createService();

    expect(
      service.evaluateCreate({
        mode: "partial_export",
        requester: {
          id: "reviewer-1",
          permissions: [
            AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
            service.profilePermission("reviewer_partial"),
          ],
        },
        sectionAccessProfile: "reviewer_partial",
      }).allowed,
    ).toBe(false);
    expect(
      service.evaluateCreate({
        mode: "partial_export",
        requester: {
          id: "reviewer-1",
          permissions: [
            AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
            service.profilePermission("reviewer_partial"),
          ],
        },
        redactionProfile: "reviewer_partial",
      }).allowed,
    ).toBe(false);
  });

  it("does not grant download capability to system internal worker", () => {
    const service = createService();

    expect(
      service.canDownload({
        requester: {
          id: "worker-1",
          permissions: [AI_DATA_PACK_EXPORT_DOWNLOAD_PERMISSION],
        },
        redactionProfile: "system_internal_worker",
      }),
    ).toBe(false);
  });
});
