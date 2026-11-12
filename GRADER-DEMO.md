# CodeTelemetry grader demo

This repository is a public demonstration of the CodeTelemetry PR gate. The
gate posts a `codetelemetry/validation` check on each pull request. The check
asks one question: before the AI coding agent pushed this commit, did it
actually validate the change? Code review does not answer that question.

Two pull requests, labelled **DO NOT MERGE - DEMO**, show the two outcomes.
They should never be merged.

| PR | Change | What the agent did before pushing | `codetelemetry/validation` |
|---|---|---|---|
| [#3](https://github.com/CodeTelemetry/hotrod/pull/3) | Break equal-ETA driver ties by driver ID | Edited the code and pushed it. It ran no tests and used no sandbox. | **Fails**: [score 0 < 70](https://github.com/CodeTelemetry/hotrod/actions/runs/42838628064/job/129907493626) |
| [#5](https://github.com/CodeTelemetry/hotrod/pull/5) | Send `Cache-Control: no-store` on the locations list | Ran build, unit tests, lint and coverage, then e2e and integration tests in a Signadot sandbox running the changed services, then pushed | **Passes**: [score 70 ≥ 70](https://github.com/CodeTelemetry/hotrod/actions/runs/43052217708/job/130632127747) |

Both PRs also pass the ordinary `Build and unit tests` check. Conventional CI
can't tell them apart; the grader can.

## How the grader works

1. **Recording.** The coding agent (Claude Code here) exports OpenTelemetry
   to CodeTelemetry. The export covers every command it runs and every result.
   Nothing is installed in this repository to do this.
2. **Linking.** When the agent opens a PR, CodeTelemetry links that PR's head
   commit to the session that produced it.
3. **Grading.** The grader is a set of weighted checks: unit tests,
   integration tests, e2e tests, coverage, build, lint, and a Signadot check.
   The Signadot check has three steps: the sandbox was ready, a request or
   test was routed into it, and the validation run succeeded.
   - A check counts only if the matching command ran **after the last code
     edit and before the push**.
   - The command must also have finished successfully.
   - The score is the satisfied weight divided by the applicable weight, as a
     percentage.
4. **Gate.** The workflow
   [`.github/workflows/codetelemetry-pr-gate.yml`](.github/workflows/codetelemetry-pr-gate.yml)
   runs on `pull_request_target`. It authenticates to CodeTelemetry with
   GitHub OIDC, so no secret is stored in the repository. It asks CodeTelemetry
   for a verdict on the PR's head commit and reports the result as
   `codetelemetry/validation`.
   - The gate that graded #3 and #5 was a shared smoke gate requiring a score
     of 70.
   - A missing score counts as a failure.
   - Tests must run before the push.

### Evidence must be unambiguous

The grader credits only commands whose result it can prove. A test piped
through another command, as in `npm test | tail`, reports the exit status of
`tail`, not of the test, so it earns nothing. PR #5's first attempt scored 0
for exactly this reason. The validation commands were rerun on their own, with
nothing piped, before the commit was pushed, and the gate then passed.
[docs/codetelemetry-enforcement.md](docs/codetelemetry-enforcement.md) lists
the exact command sequence.

## Navigating the demo

**On GitHub (public):**
- Open either PR and scroll to the checks, or use its **Checks** tab.
- Open the `codetelemetry/validation` run. Its summary shows the score and the
  number of sessions that were graded.
- The **Rules** settings show the ruleset "Hotrod required validation". It
  requires `Build and unit tests` and a code-owner approval, and has no bypass
  actors. `codetelemetry/validation` is not a required check for now. It will
  be required again once the stricter gate in
  [#4](https://github.com/CodeTelemetry/hotrod/pull/4) has been rehearsed.

**In CodeTelemetry (sign-in required):**
- The [session timeline](https://codetelemetry.com/dashboards/session-timeline?session=13a5726a-6041-421e-a3c3-515ea6135582)
  replays the agent session behind both PRs.
  - Use the turn picker to jump to a moment.
  - Filter to **Signadot** or **Failed** events.
  - Search for a command such as `npm run test:integration` to see its
    recorded input, its output, and whether it succeeded.
- [Grader configuration](https://codetelemetry.com/app/validation) lists every
  check, its weight, and what counts as a match.
- [GitHub integration](https://codetelemetry.com/app/integrations/github)
  lists the trusted repositories and their gate settings.

**In this repository:**
- [`.codetelemetry/`](.codetelemetry) holds the intended production policy:
  `grader.json`, `gate.json` and `ruleset.json`. The demo PRs were graded by
  a shared smoke gate with a threshold of 70. The checked-in `gate.json`
  describes a stricter dedicated gate with a threshold of 100. The repository
  variable `CODETELEMETRY_GATE_ID` now points at a new gate, set up for that
  stricter policy. That gate, not the smoke gate, will grade new PRs once the
  workflow is re-enabled.
- [`.signadot/codetelemetry-sandbox.yaml`](.signadot/codetelemetry-sandbox.yaml)
  is the sandbox template. It forks `frontend` and `location` onto an image
  built from the tested commit.
- [`docs/codetelemetry-enforcement.md`](docs/codetelemetry-enforcement.md)
  covers the activation order and the recorded validation procedure.

## Current status

- The gate workflow is **disabled** while the stricter gate binding in
  [#4](https://github.com/CodeTelemetry/hotrod/pull/4) is being finished. Its checks on #3 and #5 are kept as recorded, and new PRs are not
  graded until the workflow is re-enabled.
- To grade a PR again, re-enable the workflow, then push to the PR or reopen it.
