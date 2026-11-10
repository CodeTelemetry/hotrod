# CodeTelemetry enforcement

This fork is a validation benchmark. Public CI builds the exact PR revision,
runs unit tests and static checks, and never receives cluster or registry
credentials. Sandbox validation is performed by an authorized maintainer in a
recorded coding session. A fork contributor without workspace telemetry needs
that maintainer validation; missing evidence does not pass automatically.

## Activation order

1. Deploy the private grader service's strict Signadot readiness/endpoint and
   linked-before-push support, then release the companion public MCP schema.
   A client that refuses a linked `beforePush` check must be upgraded; do not
   remove the property to make a save succeed.
2. Use a dedicated Hotrod governance workspace. Review and save the six checks
   in `.codetelemetry/grader.json`, with the recorded repository identity
   `hotrod`. Publish the exact reviewed revision. Do not combine this policy
   with unrelated repositories' optional checks.
3. Configure that workspace with `.codetelemetry/gate.json`: threshold 100,
   missing score fails, complexity discounts off, required-before-push on.
   Each check has weight 1, is enabled and required, with no applicability or
   environment exemptions. Signadot failure therefore cannot be traded away.
4. Trust the exact `CodeTelemetry/hotrod` repository in that gate. Set its
   **public** gate ID as the repository Actions variable
   `CODETELEMETRY_GATE_ID`. Gate IDs are identifiers; authentication is GitHub
   OIDC. Do not put an ingest key, Signadot key or PAT in the workflow.
5. Put the reviewed build and gate workflows on the default branch. Apply
   `.codetelemetry/ruleset.json` after both check names exist. It requires
   `Build and unit tests` and `codetelemetry/validation` from GitHub Actions,
   an up-to-date branch, one fresh approval, code-owner approval and no bypass
   actors. Changes to workflows, policy and test scripts require the owners in
   CODEOWNERS; configure an additional qualified owner if needed for reviews.
6. Verify same-repository and external-fork PR behavior. On public repositories,
   check Actions event policies admit this no-checkout `pull_request_target`
   workflow and the intended actors. GitHub's announced default event block is
   December 2, 2026; consult the current policy UI before publication.

The checked-in gate refuses to pass while its gate ID is unset. Applying these
files does not provision a cluster, authorize credentials, publish a policy or
change repository visibility.

## Recorded validation after the final edit

Commit the final implementation, then execute the following as separate agent
tool commands with output capture. A single script, a pipe, or a pasted summary
does not preserve each subprocess's identity and exit status. Resolve placeholder
values from the live sandbox and use the actual values in each recorded command;
cross-call shell variables are not proof that a child process received them.

```sh
npm run build
npm run test:unit
npm run lint
signadot sandbox get SANDBOX_NAME -o json
SIGNADOT_ROUTING_KEY=ROUTING_KEY HOTROD_BASE_URL=http://frontend.NAMESPACE.svc:8080 HOTROD_EXPECT_SANDBOX=SANDBOX_NAME npm run e2e:playwright
SIGNADOT_ROUTING_KEY=ROUTING_KEY HOTROD_BASE_URL=http://frontend.NAMESPACE.svc:8080 TEST_ROUTING_KEY=ROUTING_KEY TEST_LOCATION_ADDR=location.NAMESPACE.svc:8081 TEST_FRONTEND_ADDR=frontend.NAMESPACE.svc:8080 TEST_TARGET_WORKLOAD=frontend TEST_SANDBOX_NAME=SANDBOX_NAME npm run test:integration
git push origin HEAD
```

Provision the sandbox separately with `.signadot/codetelemetry-sandbox.yaml`,
an explicitly selected CodeTelemetry cluster/namespace, and a frontend/location
image built from the exact tested commit. The template declares both service
endpoint origins. No command defaults to Signadot's registry or demo cluster.
Inspect the get result: its name must match, `status.ready` must be true, and
its routing key and declared endpoint must match the recorded test invocation.
Wait and run a fresh standalone get if it is not ready. A successful CLI call
alone is insufficient. Keep the shared baseline unchanged.

The browser suite asserts a complete ride and sandbox attribution. A routed run
requires both `SIGNADOT_ROUTING_KEY` and `HOTROD_EXPECT_SANDBOX`. Integration
requires all live addresses, routing key and sandbox identity; its runner fails
if either of its two tests skips or fails. The unit runner also fails if it
executes zero tests. Keep local report directories out of Git.

After any later source edit, repeat all required checks and the sandbox read
before pushing. Build outputs and reports are not an invitation to commit
generated assets accidentally. Test telemetry is a recorded observation, not
an independent security attestation: maintainers must still review the test
implementation and the immutable image being validated. Independent public CI
provides the build/unit result on the actual PR revision.

Negative A/B control runs should fail this enforcement policy. If a research
comparison needs a non-enforcing score, use a separate explicitly labelled
benchmark workspace; do not relax the public repository's gate.

## Release review

Preserve upstream LICENSE and attribution. Scan all reachable history and
available Actions logs before changing visibility. Historical upstream sample
database credentials must never be reused. Retain no local environment files,
native agent transcripts, private service code or authentication material in
this repository. Re-run the public/fork smoke after enabling the reviewed
policy; old green checks and incomplete historical telemetry are not acceptance
for a new head.

References: [GitHub Actions execution policies](https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution),
[Signadot sandbox specification](https://www.signadot.com/docs/reference/sandboxes/spec).
