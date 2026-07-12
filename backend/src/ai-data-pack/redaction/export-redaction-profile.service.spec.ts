import { ExportRedactionProfileService } from "./export-redaction-profile.service";

describe("ExportRedactionProfileService", () => {
  it("supports all official/partial export redaction profiles", () => {
    const service = new ExportRedactionProfileService();

    for (const profile of [
      "director_full",
      "director_redacted",
      "manager_marketer",
      "finance_operator",
      "reviewer_partial",
      "investor_redacted",
      "external_consultant_redacted",
      "system_internal_worker",
    ]) {
      expect(service.isSupported(profile)).toBe(true);
      expect(service.resolve(profile as any)).toEqual(
        expect.objectContaining({
          profile,
          redactionRuntime: "manifest_only",
          artifactRendering: "deferred",
        }),
      );
    }
  });

  it("marks redacted external profiles as not containing unscoped PII", () => {
    const service = new ExportRedactionProfileService();

    expect(service.resolve("external_consultant_redacted")).toEqual(
      expect.objectContaining({
        containsPii: false,
        containsFinancialSensitive: false,
        containsEmployeeSensitive: false,
        containsSupplierSensitive: false,
      }),
    );
  });

  it("keeps full director and internal worker sensitivity flags explicit", () => {
    const service = new ExportRedactionProfileService();

    expect(service.resolve("director_full")).toEqual(
      expect.objectContaining({
        containsPii: true,
        containsFinancialSensitive: true,
        containsEmployeeSensitive: true,
        containsSupplierSensitive: true,
      }),
    );
    expect(service.resolve("system_internal_worker")).toEqual(
      expect.objectContaining({
        containsPii: true,
        containsFinancialSensitive: true,
        containsEmployeeSensitive: true,
        containsSupplierSensitive: true,
      }),
    );
  });
});
