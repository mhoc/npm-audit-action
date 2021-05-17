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
const elideAttribution = core.getInput('elide-attribution') === 'true';
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
    markdown += `<summary>Vulnerabilities: ${totalVulnerabilities}</summary>\n\n`;
    const advisoryIds = Object.keys(advisories);
    if (advisoryIds.length === 0) {
        markdown += 'No vulnerability disclosures found :smile:\n';
    }
    else {
        markdown += '| Root Cause | Path | Severity | Vulnerability |\n';
        markdown += '|--|--|--|--|\n';
        for (const advisoryId of advisoryIds) {
            const advisory = advisories[advisoryId];
            markdown += `| ${advisory.module_name} | ${advisory.findings[0].paths[0]} | ${advisory.severity} | ${advisory.title} |\n`;
        }
        markdown += "> to observe and fix vulnerabilities, run `npm audit`\n";
    }
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
    markdown += `<summary>Outdated Packages: ${outdatedPackages.length}</summary>\n\n`;
    if (outdatedPackages.length === 0) {
        markdown += 'No outdated packages found :smile:\n';
    }
    else {
        markdown += '| Package | Current | Wanted | Latest |\n';
        markdown += `|--|--|--|--|\n`;
        for (const outdatedPackage of outdatedPackages) {
            const { current, wanted, latest } = outdatedOutput[outdatedPackage];
            markdown += `| ${outdatedPackage} | ${current} | ${wanted} | ${latest} |\n`;
        }
        markdown += '> to observe and update outdated packages, run `npm outdated`\n';
    }
    markdown += `</details>\n`;
    return {
        markdown,
        outdated: outdatedPackages.length,
    };
}
// ----------------------------------------------
// DepCheck Runner for:                         |
// * unused production and development packages |
// * missing dependencies                       |
// ----------------------------------------------
async function RunDepcheck() {
    let markdown = "";
    let { dependencies: unusedProdPackages, devDependencies: unusedDevPackages, missing: missingPackages, } = JSON.parse(await Exec("npx", ["depcheck", "--json"]));
    markdown += `<details>\n`;
    markdown += `<summary>Unused Production Dependencies: ${unusedProdPackages.length}</summary>\n\n`;
    if (unusedProdPackages.length === 0) {
        markdown += `No unused packages in production :smile:\n`;
    }
    else {
        unusedProdPackages = unusedProdPackages.sort();
        for (const packageName of unusedProdPackages) {
            markdown += `* \`${packageName}\`\n`;
        }
        markdown += '> to generate this list locally, run `npx depcheck`\n';
    }
    markdown += `</details>\n`;
    markdown += `<details>\n`;
    markdown += `<summary>Unused Dev Dependencies: ${unusedDevPackages.length}</summary>\n\n`;
    if (unusedDevPackages.length === 0) {
        markdown += `No unused packages in development :smile:\n`;
    }
    else {
        unusedDevPackages = unusedDevPackages.sort();
        for (const packageName of unusedDevPackages) {
            markdown += `* \`${packageName}\`\n`;
        }
        markdown += '> to generate this list locally, run `npx depcheck`\n';
    }
    markdown += `</details>\n`;
    let missingPackageNames = Object.keys(missingPackages);
    markdown += `<details>\n`;
    markdown += `<summary>Missing Dependencies: ${missingPackageNames.length}</summary>\n\n`;
    if (missingPackageNames.length === 0) {
        markdown += `No missing packages :smile:\n`;
    }
    else {
        missingPackageNames = missingPackageNames.sort();
        for (const packageName of missingPackageNames) {
            markdown += `* \`${packageName}\`\n`;
        }
        markdown += '> to generate this list locally, run `npx depcheck`\n';
    }
    markdown += `</details>\n`;
    return { markdown };
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
    const { markdown: depcheckMarkdown } = await RunDepcheck();
    markdown += depcheckMarkdown;
    if (!elideAttribution) {
        markdown += '\n';
        markdown += '<p align="right">\n';
        markdown += `Generated by :robot: <a href="https://github.com/mhoc/npm-audit-action">@mhoc/npm-audit-action</a> against ${process.env.GITHUB_SHA}\n`;
        markdown += '</p>\n';
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHNDQUFzQztBQUN0QywwQ0FBMEM7QUFDMUMsdUNBQXVDO0FBRXZDLDBCQUEwQjtBQUMxQiwwQkFBMEI7QUFDMUIsMEJBQTBCO0FBRTFCLE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLENBQUM7QUFDdEQsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDO0FBQ3ZELE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDO0FBRTdDLFdBQVc7QUFDWCxXQUFXO0FBQ1gsV0FBVztBQUVYLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssTUFBTSxDQUFDO0FBQy9ELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLE1BQU0sQ0FBQztBQUN2RSxNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGtCQUFrQixDQUFDLEtBQUssTUFBTSxDQUFDO0FBQ3BFLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLE1BQU0sQ0FBQztBQUU5RSxvQ0FBb0M7QUFDcEMsb0NBQW9DO0FBQ3BDLG9DQUFvQztBQUVwQyxTQUFTLElBQUksQ0FBQyxPQUFlLEVBQUUsSUFBYztJQUMzQyxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFO1FBQzlCLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3hDLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNoQixJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxN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