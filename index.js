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
        prComment += '\n';
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
            prComment += `\n`;
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