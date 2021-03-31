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
        const prNumber = github.context.payload.pull_request?.number;
        const octokit = github.getOctokit(githubToken);
        const [owner, repo] = githubRepository.split("/");
        octokit.issues.createComment({
          body: prComment,
          issue_number: prNumber!,
          owner,
          repo,
        });
      }
    });
  });
} catch (error) {
  core.setFailed(error.message);
}
