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
const failOnOutdated = core.getInput('fail-on-outdated') === 'true';
const failOnVulnerability = core.getInput('fail-on-vulnerability') === 'true';
// ---------------------------------
// Exec helper to run sub-commands |
// ---------------------------------
function Exec(command, args) {
    return new Promise((res, rej) => {
        const proc = child.spawn(command, args);
        let output = "";
        proc.stdout.on("data", (d) => { output += d.toString(); });
        proc.on("close", () => res(output));
    });
}
// ------------------------
// Env & Input Validation |
// ------------------------
if (githubEventName !== "pull_request") {
    core.setFailed('this action can only run in response to pull request events; GITHUB_EVENT_NAME !== pull_request');
    process.exit(1);
}
if (!githubRepository) {
    core.setFailed('action was not ran in the context of a github repository; GITHUB_REPOSITORY env not provided');
    process.exit(1);
}
if (!githubToken) {
    core.setFailed("GITHUB_TOKEN not found");
    process.exit(1);
}
// --------------
// Audit Runner |
// --------------
async function RunAudit() {
    let markdown = "";
    const { advisories, metadata: { totalDependencies, vulnerabilities } } = JSON.parse(await Exec("npm", ["audit", "--json"]));
    core.setOutput('total-dependencies', totalDependencies);
    markdown += `Total Dependencies: ${totalDependencies}\n`;
    const totalVulnerabilities = vulnerabilities.low + vulnerabilities.moderate + vulnerabilities.high + vulnerabilities.critical;
    core.setOutput('total-vulnerabilities', totalVulnerabilities);
    markdown += `<details>\n`;
    markdown += `<summary>Vulnerabilities: ${totalVulnerabilities}</summary>\n`;
    markdown += '| Root Cause | Path | Severity | Vulnerability |\n';
    markdown += '|--|--|--|--|\n';
    const advisoryIds = Object.keys(advisories);
    for (const advisoryId of advisoryIds) {
        const advisory = advisories[advisoryId];
        markdown += `| ${advisory.module_name} | ${advisory.findings[0].paths[0]} | ${advisory.severity} | ${advisory.title} |\n`;
    }
    markdown += "> to observe and fix vulnerabilities, run `npm audit`\n";
    markdown += `</details>\n`;
    return {
        markdown,
        vulnerabilities: totalVulnerabilities,
    };
}
// -----------------
// Outdated Runner |
// -----------------
async function RunOutdated() {
    let markdown = "";
    const outdatedOutput = JSON.parse(await Exec("npm", ["outdated", "--json"]));
    const outdatedPackages = Object.keys(outdatedOutput);
    markdown += `<details>\n`;
    markdown += `<summary>Outdated Packages: ${outdatedPackages.length}</summary>\n`;
    markdown += '| Package | Current | Wanted | Latest |\n';
    markdown += `|--|--|--|--|\n`;
    for (const outdatedPackage of outdatedPackages) {
        const { current, wanted, latest } = outdatedOutput[outdatedPackage];
        markdown += `| ${outdatedPackage} | ${current} | ${wanted} | ${latest} |\n`;
    }
    markdown += '> to observe and update outdated packages, run `npm outdated`\n';
    markdown += `</details>\n`;
    return {
        markdown,
        outdated: outdatedPackages.length,
    };
}
// ------
// Main |
// ------
async function Main() {
    let markdown = "";
    const { markdown: auditMarkdown, vulnerabilities } = await RunAudit();
    markdown += auditMarkdown;
    const { markdown: outdatedMarkdown, outdated } = await RunOutdated();
    markdown += outdatedMarkdown;
    if (shouldPrComment) {
        const prNumber = github.context.payload.pull_request.number;
        const octokit = github.getOctokit(githubToken);
        const [owner, repo] = githubRepository.split("/");
        await octokit.issues.createComment({
            body: markdown,
            issue_number: prNumber,
            owner,
            repo,
        });
    }
    if (failOnOutdated && outdated > 0) {
        core.setFailed(`${outdated} package(s) are outdated`);
        process.exit(1);
    }
    if (failOnVulnerability && vulnerabilities > 0) {
        core.setFailed(`${vulnerabilities} vulerabilitie(s) were found in this project's dependencies`);
        process.exit(1);
    }
}
// ----------------------------------------
// Bootstrap Into Async and handle errors |
// ----------------------------------------
try {
    Main().catch(err => { throw err; });
}
catch (err) {
    core.setFailed(err.message);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHNDQUFzQztBQUN0QywwQ0FBMEM7QUFDMUMsdUNBQXVDO0FBRXZDLDBCQUEwQjtBQUMxQiwwQkFBMEI7QUFDMUIsMEJBQTBCO0FBRTFCLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUM7QUFDdEQsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDO0FBQ3ZELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBRTdDLFdBQVc7QUFDWCxXQUFXO0FBQ1gsV0FBVztBQUVYLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssTUFBTSxDQUFDO0FBQy9ELE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUMsS0FBSyxNQUFNLENBQUM7QUFDcEUsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLEtBQUssTUFBTSxDQUFDO0FBRTlFLG9DQUFvQztBQUNwQyxvQ0FBb0M7QUFDcEMsb0NBQW9DO0FBRXBDLFNBQVMsSUFBSSxDQUFDLE9BQWUsRUFBRSxJQUFjO0lBQzNDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUU7UUFDOUIsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEMsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQSxD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