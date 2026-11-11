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
  assert.equal(rules.enforcement, "disabled");
  assert.deepEqual(rules.rules.find(r => r.type === "required_status_checks").parameters.required_status_checks, [
    { context: "Build and unit tests", integration_id: 15368 },
    { context: "codetelemetry/current-validation", integration_id: "REPLACE_WITH_CODETELEMETRY_APP_ID" },
  ]);
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

test("enforcement policy cannot waive or trade away required validation", () => {
  const gate = JSON.parse(fs.readFileSync(".codetelemetry/gate.json"));
  assert.deepEqual(gate, { enabled: true, minScore: 100, missingScore: "fail", complexityAware: false, requireTestBeforePush: true });
  const { checks } = JSON.parse(fs.readFileSync(".codetelemetry/grader.json"));
  assert.deepEqual(checks.map(c => c.id).sort(), ["hotrod.build", "hotrod.e2e", "hotrod.integration", "hotrod.lint", "hotrod.signadot", "hotrod.unit"]);
  for (const check of checks) {
    assert.equal(check.enabled, true);
    assert.equal(check.beforePush, true);
    assert.equal(check.repositoryId, "hotrod");
    assert.equal(check.weight, 1);
    assert.equal(check.applicabilityRule, undefined);
    assert.equal(check.environment, undefined);
    assert.notEqual(check.satisfactionMode, "observed");
  }
  const linked = checks.find(c => c.id === "hotrod.signadot");
  assert.equal(linked.linkage, "signadot");
  assert.equal(linked.components.length, 3);
  assert(linked.components.every(c => c.requireSuccess === true));
});


test("the default-branch gate rejects old/malformed/relaxed success responses", () => {
  const workflow = fs.readFileSync(".github/workflows/codetelemetry-pr-gate.yml", "utf8");
  assert.match(workflow, /CODETELEMETRY_ENFORCEMENT_APPROVED/);
  const fence = workflow.match(/# BEGIN SOURCE IMAGE FENCE\n([\s\S]*?)# END SOURCE IMAGE FENCE/)[1];
  const head = "a".repeat(40);
  const valid = { state: "success", enforced: true, managedCheck: true, reason: "score_meets_threshold", score: 100, threshold: 100,
    binding: { protocol: "source-image-v1", headSha: head, policyVersion: 1, policyDigest: "b".repeat(64), image: `ghcr.io/example/app@sha256:${"c".repeat(64)}`, validationImage: `ghcr.io/example/tests@sha256:${"d".repeat(64)}` } };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hotrod-gate-"));
  try {
    const out = path.join(tmp, "answer.json");
    const run = answer => {
      fs.writeFileSync(out, JSON.stringify(answer));
      return spawnSync("bash", ["-c", fence], { env: { ...process.env, HEAD_SHA: head, out }, encoding: "utf8" }).status;
    };
    assert.equal(run(valid), 0);
    for (const patch of [{ enforced: false }, { managedCheck: undefined }, { managedCheck: false }, { score: 99 }, { threshold: 70 }, { reason: "trivial_waived" }, { binding: undefined },
      ...[{ headSha: "e".repeat(40) }, { protocol: "old" }, { policyDigest: "wrong" }, { image: "ghcr.io/example/app:latest" }, { validationImage: null }].map(p => ({ binding: { ...valid.binding, ...p } }))]) assert.notEqual(run({ ...valid, ...patch }), 0);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
