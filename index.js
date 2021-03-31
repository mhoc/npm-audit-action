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
    markdown += `Total Dependencies: **${totalDependencies}**\n`;
    const totalVulnerabilities = vulnerabilities.low + vulnerabilities.moderate + vulnerabilities.high + vulnerabilities.critical;
    core.setOutput('total-vulnerabilities', totalVulnerabilities);
    markdown += `<details>\n`;
    markdown += `<summary>Vulnerabilities: **${totalVulnerabilities}**</summary>\n\n`;
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
    markdown += `<summary>Outdated Packages: **${outdatedPackages.length}**</summary>\n\n`;
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