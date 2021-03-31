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
        prComment += `Total Dependencies: ${totalDependencies}\n`;
        const totalVulnerabilities = vulnerabilities.low + vulnerabilities.moderate + vulnerabilities.high + vulnerabilities.critical;
        core.setOutput('total-vulnerabilities', totalVulnerabilities);
        prComment += `### Vulnerabilities (${totalVulnerabilities})\n`;
        prComment += '| Root Cause Dep | First-Level Dep | Severity | Title |\n';
        prComment += '|--|--|--|--|\n';
        const advisoryIds = Object.keys(advisories);
        for (const advisoryId of advisoryIds) {
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
            for (const outdatedPackage of outdatedPackageNames) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHNDQUFzQztBQUN0QywwQ0FBMEM7QUFDMUMsdUNBQXVDO0FBRXZDLDBCQUEwQjtBQUMxQiwwQkFBMEI7QUFDMUIsMEJBQTBCO0FBRTFCLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUM7QUFDdEQsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDO0FBQ3ZELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBRTdDLFdBQVc7QUFDWCxXQUFXO0FBQ1gsV0FBVztBQUVYLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssTUFBTSxDQUFDO0FBRS9ELElBQUk7SUFDRixJQUFJLGVBQWUsS0FBSyxjQUFjLEVBQUU7UUFDdEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpR0FBaUcsQ0FBQyxDQUFDO0tBQ3BIO0lBQ0QsSUFBSSxDQUFDLGdCQUFnQixFQUFFO1FBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsOEZBQThGLENBQUMsQ0FBQztLQUNqSDtJQUNELElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNyQixJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDbkIsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUNyRCxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRTtRQUMzQixXQUFXLElBQUksQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQzlCLENBQUMsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVB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