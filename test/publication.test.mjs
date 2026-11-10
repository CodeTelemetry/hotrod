import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("public workflows cannot push images or deploy upstream workloads", () => {
  for (const file of fs.readdirSync(".github/workflows")) {
    const source = fs.readFileSync(path.join(".github/workflows", file), "utf8");
    assert.doesNotMatch(source, /make push-docker|docker login|SIGNADOT_API_KEY|DOCKERHUB_TOKEN|SIGNADOT_ORG: signadot/);
  }
  const gate = fs.readFileSync(".github/workflows/codetelemetry-pr-gate.yml", "utf8");
  assert.doesNotMatch(gate, /uses:.*checkout/);
  assert.match(gate, /headRepository: \$head/);
  assert.match(gate, /vars.CODETELEMETRY_GATE_ID/);
  const rules = JSON.parse(fs.readFileSync(".codetelemetry/ruleset.json"));
  assert.deepEqual(rules.rules.find(r => r.type === "required_status_checks").parameters.required_status_checks.map(c => c.context).sort(), ["Build and unit tests", "codetelemetry/validation"]);
  const review = rules.rules.find(r => r.type === "pull_request").parameters;
  assert.equal(review.require_code_owner_review, true);
  assert.equal(review.dismiss_stale_reviews_on_push, true);
});

test("Go runner refuses empty tests, skipped integration and masked failure", t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hotrod-runner-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const go = path.join(tmp, "go");
  const run = (events, status = 0, mode = "unit") => {
    fs.writeFileSync(go, `#!/usr/bin/env node\nconsole.log(${JSON.stringify(events.map(e => JSON.stringify(e)).join("\n"))});process.exit(${status});\n`, { mode: 0o700 });
    return spawnSync(process.execPath, ["scripts/run-go-tests.mjs", mode], { encoding: "utf8", timeout: 5000,
      env: { ...process.env, PATH: tmp + path.delimiter + process.env.PATH,
        TEST_LOCATION_ADDR: "location.test:8081", TEST_FRONTEND_ADDR: "frontend.test:8080", TEST_TARGET_WORKLOAD: "frontend",
        TEST_SANDBOX_NAME: "synthetic", TEST_ROUTING_KEY: "synthetic" } });
  };
  assert.equal(run([{ Action: "pass", Package: "empty" }]).status, 1);
  assert.equal(run([{ Action: "pass", Test: "TestUnit" }]).status, 0);
  assert.equal(run([{ Action: "pass", Test: "TestUnit" }], 1).status, 1);
  assert.equal(run([{ Action: "pass", Test: "TestLocationClient" }, { Action: "skip", Test: "TestFrontendAPI" }], 0, "integration").status, 1);
  assert.equal(run([{ Action: "pass", Test: "TestLocationClient" }, { Action: "pass", Test: "TestFrontendAPI" }], 0, "integration").status, 0);
});
