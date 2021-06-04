import * as core from "@actions/core";
import * as github from "@actions/github";
import * as child from "child_process";

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

function Exec(command: string, args: string[]): Promise<string> {
  return new Promise((res, rej) => {
    const proc = child.spawn(command, args);
    let output = "";
    proc.stdout.on("data", (d) => { output += d.toString() });
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

async function RunAudit(): Promise<{ markdown: string, vulnerabilities: number }> {
  let markdown = "";
  const { advisories, metadata: { totalDependencies, vulnerabilities } } = JSON.parse(await Exec("npm", [ "audit", "--json" ]));
  core.setOutput('total-dependencies', totalDependencies);
  markdown += `Total Dependencies: **${totalDependencies}**\n`;
  const totalVulnerabilities = vulnerabilities.low + vulnerabilities.moderate + vulnerabilities.high + vulnerabilities.critical;
  core.setOutput('total-vulnerabilities', totalVulnerabilities);
  markdown += `<details>\n`;
  markdown += `<summary>Vulnerabilities: ${totalVulnerabilities}</summary>\n\n`;
  const advisoryIds = Object.keys(advisories);
  if (advisoryIds.length === 0) {
    markdown += 'No vulnerability disclosures found :smile:\n';
  } else {
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

async function RunOutdated(): Promise<{ markdown: string, outdated: number }> {
  let markdown = "";
  const outdatedOutput = JSON.parse(await Exec("npm", [ "outdated", "--json" ]));
  const outdatedPackages = Object.keys(outdatedOutput);
  markdown += `<details>\n`;
  markdown += `<summary>Outdated Packages: ${outdatedPackages.length}</summary>\n\n`;
  if (outdatedPackages.length === 0) {
    markdown += 'No outdated packages found :smile:\n';
  } else {
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

async function RunDepcheck(): Promise<{ markdown: string }> {
  let markdown = "";
  let {
    dependencies: unusedProdPackages,
    devDependencies: unusedDevPackages,
    missing: missingPackages,
  } = JSON.parse(await Exec("npx", [ "depcheck", "--json" ]));
  markdown += `<details>\n`;
  markdown += `<summary>Unused Production Dependencies: ${unusedProdPackages.length}</summary>\n\n`;
  if (unusedProdPackages.length === 0) {
    markdown += `No unused packages in production :smile:\n`;
  } else {
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
  } else {
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
  } else {
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

async function Main(): Promise<void> {
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
    const prNumber = github.context.payload.pull_request!.number;
    const octokit = github.getOctokit(githubToken!);
    const [owner, repo] = githubRepository!.split("/");
    await octokit.rest.issues.createComment({
      body: markdown,
      issue_number: prNumber!,
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
  Main().catch(err => { throw err });
} catch (err) {
  core.setFailed(err.message);
}
