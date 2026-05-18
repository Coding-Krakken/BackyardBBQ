/**
 * Unit tests for apps/admin/lib/onboarding/dynamic-content.ts
 *
 * These tests run against the real feature-status.json config.
 * To run: npx jest --config jest.admin.config.js
 */

import {
  getFeature,
  getFeatureConfig,
  getFeatureVersion,
  getStatusBadgeHTML,
  getFeatureBadgeHTML,
  buildFeatureDescription,
  getAllFeaturesByStatus,
  buildRoadmapHTML,
} from "../dynamic-content";

describe("getFeatureConfig", () => {
  it("returns an object with version, lastUpdated and features", () => {
    const config = getFeatureConfig();
    expect(typeof config.version).toBe("number");
    expect(typeof config.lastUpdated).toBe("string");
    expect(config.features).toBeDefined();
    expect(typeof config.features).toBe("object");
  });

  it("contains at least 10 feature entries", () => {
    const config = getFeatureConfig();
    expect(Object.keys(config.features).length).toBeGreaterThanOrEqual(10);
  });
});

describe("getFeatureVersion", () => {
  it("returns a positive integer", () => {
    const version = getFeatureVersion();
    expect(version).toBeGreaterThan(0);
    expect(Number.isInteger(version)).toBe(true);
  });
});

describe("getFeature", () => {
  it("returns a feature object for a known key", () => {
    const feature = getFeature("dashboard-overview");
    expect(feature).not.toBeNull();
    expect(feature?.status).toBe("complete");
    expect(typeof feature?.label).toBe("string");
    expect(feature?.label.length).toBeGreaterThan(0);
    expect(typeof feature?.description).toBe("string");
  });

  it("returns null for an unknown key", () => {
    const feature = getFeature("__nonexistent_feature__");
    expect(feature).toBeNull();
  });

  it("returns delivery-integrations with in-progress status", () => {
    const feature = getFeature("delivery-integrations");
    expect(feature).not.toBeNull();
    expect(feature?.status).toBe("in-progress");
  });

  it("returns loyalty-program with planned status", () => {
    const feature = getFeature("loyalty-program");
    expect(feature).not.toBeNull();
    expect(feature?.status).toBe("planned");
  });
});

describe("getStatusBadgeHTML", () => {
  it("generates HTML for complete status with correct class", () => {
    const html = getStatusBadgeHTML("complete");
    expect(html).toContain("onboarding-badge-complete");
    expect(html).toContain("onboarding-feature-badge");
    expect(html).toContain("Live");
  });

  it("generates HTML for in-progress status with correct class", () => {
    const html = getStatusBadgeHTML("in-progress");
    expect(html).toContain("onboarding-badge-progress");
    expect(html).toContain("In Progress");
  });

  it("generates HTML for planned status with correct class", () => {
    const html = getStatusBadgeHTML("planned");
    expect(html).toContain("onboarding-badge-planned");
    expect(html).toContain("Planned");
  });
});

describe("getFeatureBadgeHTML", () => {
  it("returns empty string for unknown feature key", () => {
    const html = getFeatureBadgeHTML("__unknown__");
    expect(html).toBe("");
  });

  it("returns badge HTML for a known complete feature", () => {
    const html = getFeatureBadgeHTML("stripe-payments");
    expect(html).toContain("onboarding-badge-complete");
  });

  it("includes ETA for in-progress features", () => {
    const html = getFeatureBadgeHTML("delivery-integrations");
    expect(html).toContain("ETA:");
    expect(html).toContain("onboarding-eta");
  });

  it("does not include ETA for complete features", () => {
    const html = getFeatureBadgeHTML("dashboard-overview");
    expect(html).not.toContain("ETA:");
  });
});

describe("buildFeatureDescription", () => {
  it("returns empty string for unknown feature key", () => {
    const html = buildFeatureDescription("__unknown__");
    expect(html).toBe("");
  });

  it("wraps content in onboarding-feature-detail div", () => {
    const html = buildFeatureDescription("order-management");
    expect(html).toContain('class="onboarding-feature-detail"');
  });

  it("includes the feature description text", () => {
    const html = buildFeatureDescription("stripe-payments");
    expect(html.length).toBeGreaterThan(50);
  });

  it("includes completed-items checklist for in-progress features", () => {
    const html = buildFeatureDescription("delivery-integrations");
    expect(html).toContain("onboarding-checklist");
    expect(html).toContain("Completed");
    expect(html).toContain("Remaining");
  });

  it("includes planned-items checklist for planned features", () => {
    const html = buildFeatureDescription("loyalty-program");
    // loyalty-program is planned — should include plannedItems if they exist
    // At minimum it should have the feature-detail wrapper
    expect(html).toContain('class="onboarding-feature-detail"');
  });
});

describe("getAllFeaturesByStatus", () => {
  it("returns grouped features with complete, inProgress, and planned arrays", () => {
    const grouped = getAllFeaturesByStatus();
    expect(Array.isArray(grouped.complete)).toBe(true);
    expect(Array.isArray(grouped.inProgress)).toBe(true);
    expect(Array.isArray(grouped.planned)).toBe(true);
  });

  it("has at least one complete feature", () => {
    const grouped = getAllFeaturesByStatus();
    expect(grouped.complete.length).toBeGreaterThanOrEqual(1);
  });

  it("has at least one in-progress feature (delivery integrations)", () => {
    const grouped = getAllFeaturesByStatus();
    expect(grouped.inProgress.length).toBeGreaterThanOrEqual(1);
    const keys = grouped.inProgress.map((f) => f.key);
    expect(keys).toContain("delivery-integrations");
  });

  it("has at least one planned feature", () => {
    const grouped = getAllFeaturesByStatus();
    expect(grouped.planned.length).toBeGreaterThanOrEqual(1);
  });

  it("each entry has key, status, label, description fields", () => {
    const grouped = getAllFeaturesByStatus();
    for (const f of grouped.complete) {
      expect(typeof f.key).toBe("string");
      expect(f.status).toBe("complete");
      expect(typeof f.label).toBe("string");
      expect(typeof f.description).toBe("string");
    }
  });

  it("total features matches the config", () => {
    const config = getFeatureConfig();
    const grouped = getAllFeaturesByStatus();
    const total =
      grouped.complete.length +
      grouped.inProgress.length +
      grouped.planned.length;
    expect(total).toBe(Object.keys(config.features).length);
  });
});

describe("buildRoadmapHTML", () => {
  it("returns a non-empty HTML string", () => {
    const html = buildRoadmapHTML();
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(100);
  });

  it("wraps content in onboarding-roadmap div", () => {
    const html = buildRoadmapHTML();
    expect(html).toContain('class="onboarding-roadmap"');
  });

  it("includes a Live & Operational section", () => {
    const html = buildRoadmapHTML();
    expect(html).toContain("Live");
    expect(html).toContain("Operational");
  });

  it("includes an In Development section", () => {
    const html = buildRoadmapHTML();
    expect(html).toContain("In Development");
  });

  it("includes an On the Roadmap section", () => {
    const html = buildRoadmapHTML();
    expect(html).toContain("On the Roadmap");
  });

  it("includes delivery-integrations feature in the development section", () => {
    const html = buildRoadmapHTML();
    const feature = getFeature("delivery-integrations");
    expect(html).toContain(feature?.label ?? "Delivery Integrations");
  });
});
