"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core = require("@actions/core");
const github = require("@actions/github");
const Exec_1 = require("./Exec");
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
// -----------------------------------------------------------
// Sub-Commands which we run to get data about dependencies. |
// -----------------------------------------------------------
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
    const { advisories, metadata: { totalDependencies, vulnerabilities } } = JSON.parse((await Exec_1.Exec("npm", ["audit", "--json"])).stdout);
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
    const outdatedOutput = JSON.parse((await Exec_1.Exec("npm", ["outdated", "--json"])).stdout);
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
    let { dependencies: unusedProdPackages, devDependencies: unusedDevPackages, missing: missingPackages, } = JSON.parse((await Exec_1.Exec("npx", ["depcheck", "--json"])).stdout);
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
        await octokit.rest.issues.createComment({
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxzQ0FBc0M7QUFDdEMsMENBQTBDO0FBRTFDLGlDQUE4QjtBQUU5QiwwQkFBMEI7QUFDMUIsMEJBQTBCO0FBQzFCLDBCQUEwQjtBQUUxQixNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDO0FBQ3RELE1BQU0sZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQztBQUN2RCxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQztBQUU3QyxXQUFXO0FBQ1gsV0FBVztBQUNYLFdBQVc7QUFFWCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxLQUFLLE1BQU0sQ0FBQztBQUMvRCxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsS0FBSyxNQUFNLENBQUM7QUFDdkUsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLE1BQU0sQ0FBQztBQUNwRSxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsdUJBQXVCLENBQUMsS0FBSyxNQUFNLENBQUM7QUFFOUUsOERBQThEO0FBQzlELDhEQUE4RDtBQUM5RCw4REFBOEQ7QUFFOUQsMkJBQTJCO0FBQzNCLDJCQUEyQjtBQUMzQiwyQkFBMkI7QUFFM0IsSUFBSSxlQUFlLEtBQUssY0FBYyxFQUFFO0lBQ3RDLElBQUksQ0FBQyxTQUFTLENBQUMsaUdBQWlHLENBQUMsQ0FBQztJQUNsSCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ2pCO0FBRUQsSUFBSSxDQUFDLGdCQUFnQixFQUFFO0lBQ3JCLElBQUksQ0FBQyxTQUFTLENBQUMsOEZBQThGLENBQUMsQ0FBQztJQUMvRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ2pCO0FBRUQsSUFBSSxDQUFDLFdBQVcsRUFBRTtJQUNoQixJQUFJLENBQUMsU0FBUyxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFDekMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztDQUNqQjtBQUVELGlCQUFpQjtBQUNqQixpQkFBaUI7QUFDakIsaUJBQWlCO0FBRWpCLEtBQUssVUFBVSxRQUFRO0lBQ3JCLElBQUksUUFBUSxHQUFHLEVBQUUsQ0FBQztJQUNsQixNQUFNLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxFQUFFLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FDakYsQ0FBQyxNQUFNLFdBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBRSxPQUFPLEVBQUUsUUFBUSxDQUFFLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FDbEQsQ0FBQztJQUNGLElBQUksQ0FBQyxTQUFTLENBQUMsb0JBQW9CLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztJQUN4RCxRQUFRLElBQUkseUJBQXlCLGlCQUFpQixNQUFNLENBQUM7SUFDN0QsTUFBTSxvQkFBb0IsR0FBRyxlQUFlLENBQUMsR0FBRyxHQUFHLGVBQWUsQ0FBQyxRQUFRLEdBQUcsZUFBZSxDQUFDLElBQUksR0FBRyxlQUFlLENBQUMsUUFBUSxDQUFDO0lBQzlILElBQUksQ0FBQyxTQUFTLENBQUMsdUJBQXVCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztJQUM5RCxRQUFRLElBQUksYUFBYSxDQUFDO0lBQzFCLFFBQVEsSUFBSSw2QkFBNkIsb0JBQW9CLGdCQUFnQixDQUFDO0lBQzlFLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDNUMsSUFBSSxXQUFXLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUM1QixRQUFRLElBQUksOENBQThDLENBQUM7S0FDNUQ7U0FBTTtRQUNMLFFBQVEsSUFBSSxvREFBb0QsQ0FBQztRQUNqRSxRQUFRLElBQUksaUJBQWlCLENBQUM7UUFDOUIsS0FBSyxNQUFNLFVBQVUsSUFBSSxXQUFXLEVBQUU7WUFDcEMsTUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3hDLFFBQVEsSUFBSSxLQUFLLFFBQVEsQ0FBQyxXQUFXLE1BQU0sUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sUUFBUSxDQUFDLFFBQVEsTUFBTSxRQUFRLENBQUMsS0FBSyxNQUFNLENBQUM7U0FDM0g7UUFDRCxRQUFRLElBQUkseURBQXlELENBQUM7S0FDdkU7SUFDRCxRQUFRLElBQUksY0FBYyxDQUFDO0lBQzNCLE9BQU87UUFDTCxRQUFRO1FBQ1IsZUFBZSxFQUFFLG9CQUFvQjtLQUN0QyxDQUFDO0FBQ0osQ0FBQztBQUVELG9CQUFvQjtBQUNwQixvQkFBb0I7QUFDcEIsb0JBQW9CO0FBRXBCLEtBQUssVUFBVSxXQUFXO0lBQ3hCLElBQUksUUFBUSxHQUFHLEVBQUUsQ0FBQztJQUNsQixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUMvQixDQUFDLE1BQU0sV0FBSSxDQUFDLEtBQUssRUFBRSxDQUFFLFVBQVUsRUFBRSxRQUFRLENBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUNyRCxDQUFDO0lBQ0YsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3JELFFBQVEsSUFBSSxhQUFhLENBQUM7SUFDMUIsUUFBUSxJQUFJLCtCQUErQixnQkFBZ0IsQ0FBQyxNQUFNLGdCQUFnQixDQUFDO0lBQ25GLElBQUksZ0JBQWdCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUNqQyxRQUFRLElBQUksc0NBQXNDLENBQUM7S0FDcEQ7U0FBTTtRQUNMLFFBQVEsSUFBSSwyQ0FBMkMsQ0FBQztRQUN4RCxRQUFRLElBQUksaUJBQWlCLENBQUM7UUFDOUIsS0FBSyxNQUFNLGVBQWUsSUFBSSxnQkFBZ0IsRUFBRTtZQUM5QyxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxjQUFjLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDcEUsUUFBUSxJQUFJLEtBQUssZUFBZSxNQUFNLE9BQU8sTUFBTSxNQUFNLE1BQU0sTUFBTSxNQUFNLENBQUM7U0FDN0U7UUFDRCxRQUFRLElBQUksaUVBQWlFLENBQUM7S0FDL0U7SUFDRCxRQUFRLElBQUksY0FBYyxDQUFDO0lBQzNCLE9BQU87UUFDTCxRQUFRO1FBQ1IsUUFBUSxFQUFFLGdCQUFnQixDQUFDLE1BQU07S0FDbEMsQ0FBQztBQUNKLENBQUM7QUFFRCxpREFBaUQ7QUFDakQsaURBQWlEO0FBQ2pELGlEQUFpRDtBQUNqRCxpREFBaUQ7QUFDakQsaURBQWlEO0FBRWpELEtBQUssVUFBVSxXQUFXO0lBQ3hCLElBQUksUUFBUSxHQUFHLEVBQUUsQ0FBQztJQUNsQixJQUFJLEVBQ0YsWUFBWSxFQUFFLGtCQUFrQixFQUNoQyxlQUFlLEVBQUUsaUJBQWlCLEVBQ2xDLE9BQU8sRUFBRSxlQUFlLEdBQ3pCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLE1BQU0sV0FBSSxDQUFDLEtBQUssRUFBRSxDQUFFLFVBQVUsRUFBRSxRQUFRLENBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckUsUUFBUSxJQUFJLGFBQWEsQ0FBQztJQUMxQixRQUFRLElBQUksNENBQTRDLGtCQUFrQixDQUFDLE1BQU0sZ0JBQWdCLENBQUM7SUFDbEcsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ25DLFFBQVEsSUFBSSw0Q0FBNEMsQ0FBQztLQUMxRDtTQUFNO1FBQ0wsa0JBQWtCLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDL0MsS0FBSyxNQUFNLFdBQVcsSUFBSSxrQkFBa0IsRUFBRTtZQUM1QyxRQUFRLElBQUksT0FBTyxXQUFXLE1BQU0sQ0FBQztTQUN0QztRQUNELFFBQVEsSUFBSSx1REFBdUQsQ0FBQztLQUNyRTtJQUNELFFBQVEsSUFBSSxjQUFjLENBQUM7SUFDM0IsUUFBUSxJQUFJLGFBQWEsQ0FBQztJQUMxQixRQUFRLElBQUkscUNBQXFDLGlCQUFpQixDQUFDLE1BQU0sZ0JBQWdCLENBQUM7SUFDMUYsSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1FBQ2xDLFFBQVEsSUFBSSw2Q0FBNkMsQ0FBQztLQUMzRDtTQUFNO1FBQ0wsaUJBQWlCLEdBQUcsaUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDN0MsS0FBSyxNQUFNLFdBQVcsSUFBSSxpQkFBaUIsRUFBRTtZQUMzQyxRQUFRLElBQUksT0FBTyxXQUFXLE1BQU0sQ0FBQztTQUN0QztRQUNELFFBQVEsSUFBSSx1REFBdUQsQ0FBQztLQUNyRTtJQUNELFFBQVEsSUFBSSxjQUFjLENBQUM7SUFDM0IsSUFBSSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3ZELFFBQVEsSUFBSSxhQUFhLENBQUM7SUFDMUIsUUFBUSxJQUFJLGtDQUFrQyxtQkFBbUIsQ0FBQyxNQUFNLGdCQUFnQixDQUFDO0lBQ3pGLElBQUksbUJBQW1CLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUNwQyxRQUFRLElBQUksK0JBQStCLENBQUM7S0FDN0M7U0FBTTtRQUNMLG1CQUFtQixHQUFHLG1CQUFtQixDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2pELEtBQUssTUFBTSxXQUFXLElBQUksbUJBQW1CLEVBQUU7WUFDN0MsUUFBUSxJQUFJLE9BQU8sV0FBVyxNQUFNLENBQUM7U0FDdEM7UUFDRCxRQUFRLElBQUksdURBQXVELENBQUM7S0FDckU7SUFDRCxRQUFRLElBQUksY0FBYyxDQUFDO0lBQzNCLE9BQU8sRUFBRSxRQUFRLEVBQUUsQ0FBQztBQUN0QixDQUFDO0FBRUQsU0FBUztBQUNULFNBQVM7QUFDVCxTQUFTO0FBRVQsS0FBSyxVQUFVLElBQUk7SUFDakIsSUFBSSxRQUFRLEdBQUcsRUFBRSxDQUFDO0lBQ2xCLE1BQU0sRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxHQUFHLE1BQU0sUUFBUSxFQUFFLENBQUM7SUFDdEUsUUFBUSxJQUFJLGFBQWEsQ0FBQztJQUMxQixNQUFNLEVBQUUsUUFBUSxFQUFFLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxHQUFHLE1BQU0sV0FBVyxFQUFFLENBQUM7SUFDckUsUUFBUSxJQUFJLGdCQUFnQixDQUFDO0lBQzdCLE1BQU0sRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsR0FBRyxNQUFNLFdBQVcsRUFBRSxDQUFDO0lBQzNELFFBQVEsSUFBSSxnQkFBZ0IsQ0FBQztJQUM3QixJQUFJLENBQUMsZ0JBQWdCLEVBQUU7UUFDckIsUUFBUSxJQUFJLElBQUksQ0FBQztRQUNqQixRQUFRLElBQUkscUJBQXFCLENBQUM7UUFDbEMsUUFBUSxJQUFJLDhHQUE4RyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxDQUFDO1FBQ3JKLFFBQVEsSUFBSSxRQUFRLENBQUM7S0FDdEI7SUFDRCxJQUFJLGVBQWUsRUFBRTtRQUNuQixNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFhLENBQUMsTUFBTSxDQUFDO1FBQzdELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsV0FBWSxDQUFDLENBQUM7UUFDaEQsTUFBTSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxnQkFBaUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbkQsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUM7WUFDdEMsSUFBSSxFQUFFLFFBQVE7WUFDZCxZQUFZLEVBQUUsUUFBUztZQUN2QixLQUFLO1lBQ0wsSUFBSTtTQUNMLENBQUMsQ0FBQztLQUNKO0lBQ0QsSUFBSSxjQUFjLElBQUksUUFBUSxHQUFHLENBQUMsRUFBRTtRQUNsQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsUUFBUSwwQkFBMEIsQ0FBQyxDQUFDO1FBQ3RELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDakI7SUFDRCxJQUFJLG1CQUFtQixJQUFJLGVBQWUsR0FBRyxDQUFDLEVBQUU7UUFDOUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLGVBQWUsNkRBQTZELENBQUMsQ0FBQztRQUNoRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2pCO0FBQ0gsQ0FBQztBQUVELDJDQUEyQztBQUMzQywyQ0FBMkM7QUFDM0MsMkNBQTJDO0FBRTNDLElBQUk7SUFDRixJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxNQUFNLEdBQUcsQ0FBQSxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ3BDO0FBQUMsT0FBTyxHQUFHLEVBQUU7SUFDWixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztDQUM3QiJ9