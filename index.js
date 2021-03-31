"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github = require("@actions/github");
const child = require("child_process");
// -----------------------
// Environment Variables |
// -----------------------
const githubEventName = process.env.GITHUB_EVENT_NAME;
const githubRepository = process.env.GITHUB_REPOSITORY;
const githubToken = process.env.GITHUB_TOKEN;
// --------
// Inputs |
// --------
const elide = core.getInput("elide") ? Number(core.getInput("elide")) : 0;
const shouldPrComment = core.getInput('comment-pr') === 'true';
try {
    if (githubEventName !== "pull_request") {
        throw new Error('this action can only run in response to pull request events; GITHUB_EVENT_NAME !== pull_request');
    }
    if (!githubRepository) {
        throw new Error('action was not ran in the context of a github repository; GITHUB_REPOSITORY env not provided');
    }
    let auditOutput = "";
    let prComment = "";
    const proc = child.spawn("npm", ["audit", "--json"]);
    proc.stdout.on("data", (d) => {
        auditOutput += d.toString();
    });
    proc.on("close", () => {
        const { advisories, metadata: { totalDependencies, vulnerabilities } } = JSON.parse(auditOutput);
        core.setOutput('total-dependencies', totalDependencies);
        prComment += `## Total Dependencies: ${totalDependencies}\n`;
        const totalVulnerabilities = vulnerabilities.low + vulnerabilities.moderate + vulnerabilities.high + vulnerabilities.critical;
        core.setOutput('total-vulnerabilities', totalVulnerabilities);
        prComment += `### Vulnerabilities (${totalVulnerabilities})\n`;
        prComment += '| Root Cause | Path | Severity | Vulnerability |\n';
        prComment += '|--|--|--|--|\n';
        const advisoryIds = Object.keys(advisories);
        for (let advisoryn = 0; advisoryn < advisoryIds.length; advisoryn++) {
            if (elide > 0 && advisoryn > elide) {
                break;
            }
            const advisoryId = advisoryIds[advisoryn];
            const advisory = advisories[advisoryId];
            prComment += `| ${advisory.module_name} | ${advisory.findings[0].paths[0]} | ${advisory.severity} | ${advisory.title} |\n`;
        }
        prComment += "> to observe and fix issues, run `npm audit`\n\n";
        const proc2 = child.spawn("npm", ["outdated", "--json"]);
        let outdatedOutput = "";
        proc2.stdout.on("data", (d) => {
            outdatedOutput += d.toString();
        });
        proc2.on("close", () => {
            var _a;
            const outdatedOutputObj = JSON.parse(outdatedOutput);
            const outdatedPackageNames = Object.keys(outdatedOutputObj);
            prComment += `### Outdated Packages (${outdatedPackageNames.length})\n`;
            prComment += '| Package | Current | Wanted | Latest |\n';
            prComment += `|--|--|--|--|\n`;
            for (let outdatedPackageNamesn = 0; outdatedPackageNamesn < outdatedPackageNames.length; outdatedPackageNamesn++) {
                if (elide > 0 && outdatedPackageNamesn > elide) {
                    break;
                }
                const outdatedPackage = outdatedPackageNames[outdatedPackageNamesn];
                const { current, wanted, latest } = outdatedOutputObj[outdatedPackage];
                prComment += `| ${outdatedPackage} | ${current} | ${wanted} | ${latest} |\n`;
            }
            prComment += '> to observe and update outdated packages, run `npm outdated`\n\n';
            if (elide > 0) {
                prComment += "> some results may be elided for brevity.";
            }
            if (shouldPrComment) {
                if (!githubToken) {
                    throw new Error("GITHUB_TOKEN not found");
                }
                const prNumber = (_a = github.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.number;
                const octokit = github.getOctokit(githubToken);
                const [owner, repo] = githubRepository.split("/");
                octokit.issues.createComment({
                    body: prComment,
                    issue_number: prNumber,
                    owner,
                    repo,
                });
            }
        });
    });
}
catch (error) {
    core.setFailed(error.message);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHNDQUFzQztBQUN0QywwQ0FBMEM7QUFDMUMsdUNBQXVDO0FBRXZDLDBCQUEwQjtBQUMxQiwwQkFBMEI7QUFDMUIsMEJBQTBCO0FBRTFCLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUM7QUFDdEQsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDO0FBQ3ZELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBRTdDLFdBQVc7QUFDWCxXQUFXO0FBQ1gsV0FBVztBQUVYLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMxRSxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxLQUFLLE1BQU0sQ0FBQztBQUUvRCxJQUFJO0lBQ0YsSUFBSSxlQUFlLEtBQUssY0FBYyxFQUFFO1FBQ3RDLE1BQU0sSUFBSSxLQUFLLENBQUMsaUdBQWlHLENBQUMsQ0FBQztLQUNwSDtJQUNELElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtRQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLDhGQUE4RixDQUFDLENBQUM7S0FDakg7SUFDRCxJQUFJLFdBQVcsR0FBRyxFQUFFLENBQUM7SUFDckIsSUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDO0lBQ25CLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDckQsSUFBSSxDQUFDLE1BQU0sQ0FB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