/**
 * Unit tests for apps/admin/lib/onboarding/tour-steps.ts
 *
 * Validates the structure and integrity of the tour step registry.
 * To run: npx jest --config jest.admin.config.js
 */

import { getTourSteps, getTourGroups } from "../tour-steps";
import { getFeatureConfig } from "../dynamic-content";

describe("getTourSteps – structural integrity", () => {
  it("returns a non-empty array", () => {
    const steps = getTourSteps();
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBeGreaterThanOrEqual(30);
  });

  it("every step has a non-empty id string", () => {
    const steps = getTourSteps();
    for (const step of steps) {
      expect(typeof step.id).toBe("string");
      expect(step.id.trim().length).toBeGreaterThan(0);
    }
  });

  it("every step has a non-empty group string", () => {
    const steps = getTourSteps();
    for (const step of steps) {
      expect(typeof step.group).toBe("string");
      expect(step.group.trim().length).toBeGreaterThan(0);
    }
  });

  it("every step has a popover with non-empty title and description", () => {
    const steps = getTourSteps();
    for (const step of steps) {
      expect(step.popover).toBeDefined();
      expect(typeof step.popover.title).toBe("string");
      expect(step.popover.title.trim().length).toBeGreaterThan(0);
      expect(typeof step.popover.description).toBe("string");
      expect(step.popover.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("all step IDs are unique", () => {
    const steps = getTourSteps();
    const ids = steps.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("popover side values are valid when set", () => {
    const validSides = ["top", "bottom", "left", "right"];
    const steps = getTourSteps();
    for (const step of steps) {
      if (step.popover.side !== undefined) {
        expect(validSides).toContain(step.popover.side);
      }
    }
  });

  it("popover align values are valid when set", () => {
    const validAligns = ["start", "center", "end"];
    const steps = getTourSteps();
    for (const step of steps) {
      if (step.popover.align !== undefined) {
        expect(validAligns).toContain(step.popover.align);
      }
    }
  });
});

describe("getTourSteps – feature key integrity", () => {
  it("all featureKey references exist in the feature config", () => {
    const steps = getTourSteps();
    const config = getFeatureConfig();
    const knownKeys = new Set(Object.keys(config.features));

    for (const step of steps) {
      if (step.featureKey !== undefined) {
        expect(knownKeys.has(step.featureKey)).toBe(true);
      }
    }
  });

  it("has steps covering delivery-integrations (in-progress feature)", () => {
    const steps = getTourSteps();
    const deliveryStep = steps.find((s) => s.featureKey === "delivery-integrations");
    expect(deliveryStep).toBeDefined();
  });

  it("has steps covering stripe-payments (complete feature)", () => {
    const steps = getTourSteps();
    const paymentStep = steps.find((s) => s.featureKey === "stripe-payments");
    expect(paymentStep).toBeDefined();
  });
});

describe("getTourSteps – group coverage", () => {
  const expectedGroups = [
    "welcome",
    "navigation",
    "orders",
    "catering",
    "customers",
    "menu",
    "payments",
    "analytics",
    "integrations",
    "roadmap",
  ];

  it("covers all expected groups", () => {
    const steps = getTourSteps();
    const presentGroups = new Set(steps.map((s) => s.group));
    for (const group of expectedGroups) {
      expect(presentGroups.has(group)).toBe(true);
    }
  });
});

describe("getTourGroups", () => {
  it("returns a non-empty array of groups", () => {
    const groups = getTourGroups();
    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBeGreaterThanOrEqual(8);
  });

  it("every group has id, label, icon, and positive stepCount", () => {
    const groups = getTourGroups();
    for (const group of groups) {
      expect(typeof group.id).toBe("string");
      expect(group.id.trim().length).toBeGreaterThan(0);
      expect(typeof group.label).toBe("string");
      expect(group.label.trim().length).toBeGreaterThan(0);
      expect(typeof group.icon).toBe("string");
      expect(group.stepCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("total stepCount across all groups equals total steps", () => {
    const groups = getTourGroups();
    const steps = getTourSteps();
    const totalFromGroups = groups.reduce((sum, g) => sum + g.stepCount, 0);
    expect(totalFromGroups).toBe(steps.length);
  });

  it("each group id is unique", () => {
    const groups = getTourGroups();
    const ids = groups.map((g) => g.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("welcome group exists with at least one step", () => {
    const groups = getTourGroups();
    const welcome = groups.find((g) => g.id === "welcome");
    expect(welcome).toBeDefined();
    expect(welcome?.stepCount).toBeGreaterThanOrEqual(1);
  });

  it("integrations group exists (covers in-progress delivery features)", () => {
    const groups = getTourGroups();
    const integrations = groups.find((g) => g.id === "integrations");
    expect(integrations).toBeDefined();
    expect(integrations?.stepCount).toBeGreaterThanOrEqual(1);
  });

  it("roadmap group exists (future development overview)", () => {
    const groups = getTourGroups();
    const roadmap = groups.find((g) => g.id === "roadmap");
    expect(roadmap).toBeDefined();
  });
});
