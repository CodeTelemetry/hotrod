import { spawn } from "node:child_process";
import readline from "node:readline";

const integration = process.argv[2] === "integration";
const env = { ...process.env };
if (integration) {
  for (const key of ["TEST_LOCATION_ADDR", "TEST_FRONTEND_ADDR", "TEST_TARGET_WORKLOAD", "TEST_SANDBOX_NAME", "TEST_ROUTING_KEY"])
    if (!env[key]) throw new Error(`Set ${key} before running sandbox integration tests`);
} else {
  // Unit CI must not reach a developer's live cluster through inherited env.
  for (const key of Object.keys(env)) if (key.startsWith("TEST_")) delete env[key];
}
const args = ["test", "-json", "-count=1", "-timeout", "90s", ...(integration
  ? ["-run", "^(TestLocationClient|TestFrontendAPI)$", "./services/location", "./services/frontend"] : ["./..."])];
const child = spawn("go", args, { env, stdio: ["ignore", "pipe", "inherit"] });
const exited = new Promise((resolve, reject) => { child.once("close", resolve); child.once("error", reject); });
let passed = 0, failed = 0, skipped = 0, malformed = false;
const lines = readline.createInterface({ input: child.stdout });
for await (const line of lines) {
  try {
    const event = JSON.parse(line);
    if (event.Action === "pass" && event.Test) passed++;
    if (event.Action === "fail") failed++;
    if (event.Action === "skip" && event.Test) skipped++;
    if (typeof event.Output === "string") process.stdout.write(event.Output);
  } catch { malformed = true; }
}
const code = await exited;
if (code !== 0 || failed || malformed || passed === 0 || (integration && (passed !== 2 || skipped !== 0))) {
  console.error(`Validation failed: exit=${code}, passed=${passed}, failed=${failed}, skipped=${skipped}`);
  process.exitCode = 1;
} else console.log(`${passed} tests passed, ${skipped} skipped`);
