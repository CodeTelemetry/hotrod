import { defineConfig, devices } from "@playwright/test";

const namespace = process.env.HOTROD_NAMESPACE;
const baseURL = process.env.HOTROD_BASE_URL ||
  (namespace ? `http://frontend.${namespace}.svc:8080` : undefined);
if (!baseURL) throw new Error("Set HOTROD_BASE_URL or HOTROD_NAMESPACE before running live browser tests");
const routingKey = process.env.SIGNADOT_ROUTING_KEY;

export default defineConfig({
  testDir: "./playwright-tests",
  timeout: 60_000,
  globalTimeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["line"], ["html", { open: "never" }], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL,
    trace: "on",
    video: "on",
    screenshot: "only-on-failure",
    extraHTTPHeaders: routingKey ? {
      baggage: `sd-routing-key=${routingKey}`,
      tracestate: `sd-routing-key=${routingKey}`,
    } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
