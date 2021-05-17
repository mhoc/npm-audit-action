# npm-audit-action

A github action which runs an `npm audit` and `npm outdated` during pull requests, commenting back
the results in a user-friendly way.

By default, this workflow does not "fail" if any vulnerabilities or outdated packages are found, but
input options are available to receive this behavior if you desire.

## Example Workflow

```yaml
name: AuditDependencies
on:
  pull_request:
    types: [opened]
jobs:
  Run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js 12.x
        uses: actions/setup-node@v1
        with:
          node-version: "12.x"
      - run: npm ci
      - name: Run Audit
        uses: mhoc/npm-audit-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

- `comment-pr` (default `"true"`): provide 'true' or 'false' to control whether the action should comment the results back to the pull request.

- `elide-attribtion` (default: `"false"`): by default, this generates a final line that links back to this repository, to provide a hyperlink for submitting bugs and such. set to 'true' to remove this.

- `fail-on-outdated` (default: `"false"`): provide 'true' to fail the workflow if any outdated packages are found

- `fail-on-vulnerability` (default: `"false"`): provide 'true' to fail the workflow if any vulnerabilities are found

## Outputs

If you'd like to simply use this as a precursor step to some other workflow, and just access the outputs to get
a count of vulnerabilities rather than dealing with parsing the JSON output of an `npm audit`, these outputs
are also provided.

- `total-dependencies`: the total number of transitive dependencies your project has

- `total-vulnerabilities`: the total number of open vulnerabilities your project has
