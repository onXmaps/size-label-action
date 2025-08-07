#!/usr/bin/env node

const fs = require("fs");
const process = require("process");

const { Octokit } = require("@octokit/rest");
const globrex = require("globrex");

const HttpsProxyAgent = require("https-proxy-agent");

const defaultSizes = {
  0: "XS",
  10: "S",
  30: "M",
  100: "L",
  500: "XL",
  1000: "XXL"
};

const actions = ["opened", "synchronize", "reopened", "ready_for_review"];

const globrexOptions = { extended: true, globstar: true };

async function main() {
  debug("Running size-label-action...");

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    throw new Error("Environment variable GITHUB_TOKEN not set!");
  }

  const GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;
  if (!GITHUB_EVENT_PATH) {
    throw new Error("Environment variable GITHUB_EVENT_PATH not set!");
  }

  const eventDataStr = await readFile(GITHUB_EVENT_PATH);
  const eventData = JSON.parse(eventDataStr);

  if (!eventData || !eventData.pull_request || !eventData.pull_request.base) {
    throw new Error(`Invalid GITHUB_EVENT_PATH contents: ${eventDataStr}`);
  }

  debug("Event payload:", eventDataStr);

  if (!actions.includes(eventData.action)) {
    console.log("Action will be ignored:", eventData.action);
    return false;
  }

  // Check if we should run on draft PRs
  const runOnDraft = getRunOnDraftInput();
  const isDraft = eventData.pull_request.draft === true;

  if (isDraft && !runOnDraft) {
    console.log("Skipping draft PR as run-on-draft is disabled");
    return false;
  }

  debug("PR is draft:", isDraft, "run-on-draft:", runOnDraft);

  const isIgnored = parseIgnored(process.env.IGNORED);

  const pullRequestHome = {
    owner: eventData.pull_request.base.repo.owner.login,
    repo: eventData.pull_request.base.repo.name
  };

  const pull_number = eventData.pull_request.number;

  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;

  const octokit = new Octokit({
    auth: `token ${GITHUB_TOKEN}`,
    baseUrl: process.env.GITHUB_API_URL || "https://api.github.com",
    userAgent: "pascalgn/size-label-action",
    ...(proxyUrl && { request: { agent: new HttpsProxyAgent(proxyUrl) } })
  });

  const pullRequestFiles = await octokit.pulls.listFiles({
    ...pullRequestHome,
    pull_number,
    headers: {
      accept: "application/vnd.github.raw+json"
    }
  });

  const changedLines = getChangedLines(isIgnored, pullRequestFiles.data);
  console.log("Changed lines:", changedLines);

  if (isNaN(changedLines)) {
    throw new Error(`could not get changed lines: '${changedLines}'`);
  }

  const sizes = getSizesInput();
  const sizeLabel = getSizeLabel(changedLines, sizes);
  const sizeValue = sizeLabel ? sizeLabel.replace("size/", "") : null;
  const isCustomSizes = sizes !== undefined;

  console.log("Matching label:", sizeLabel);
  console.log("Size value:", sizeValue);
  console.log("Using custom sizes:", isCustomSizes);

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    const outputs = [
      `size-label=${sizeLabel || ""}`,
      `size=${sizeValue || ""}`,
      `changed-lines=${changedLines}`,
      `is-custom-sizes=${isCustomSizes}`,
      `sizes-config=${JSON.stringify(sizes || defaultSizes)}`,
      `sizeLabel=${sizeLabel || ""}` // Legacy support
    ];
    fs.appendFileSync(githubOutput, outputs.join("\n") + "\n");
    debug(`Written outputs to ${githubOutput}:`, outputs);
  }

  console.log("About to get label changes...");
  console.log("eventData.pull_request.labels:", JSON.stringify(eventData.pull_request.labels, null, 2));

  const { add, remove } = getLabelChanges(
    sizeLabel,
    eventData.pull_request.labels
  );

  console.log("Label changes calculated - add:", add, "remove:", remove);

  if (add.length === 0 && remove.length === 0) {
    console.log("Correct label already assigned");
    return false;
  }

  if (add.length > 0) {
    debug("Adding labels:", add);
    await octokit.issues.addLabels({
      ...pullRequestHome,
      issue_number: pull_number,
      labels: add
    });
  }

  for (const label of remove) {
    debug("Removing label:", label);
    try {
      await octokit.issues.removeLabel({
        ...pullRequestHome,
        issue_number: pull_number,
        name: label
      });
    } catch (error) {
      debug("Ignoring removing label error:", error);
    }
  }

  debug("Success!");

  return true;
}

function debug(...str) {
  if (process.env.DEBUG_ACTION) {
    console.log.apply(console, str);
  }
}

function parseIgnored(str = "") {
  const ignored = (str || "")
    .split(/\r|\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith("#"))
    .map(s =>
      s.length > 1 && s[0] === "!"
        ? { not: globrex(s.slice(1), globrexOptions) }
        : globrex(s, globrexOptions)
    );
  function isIgnored(path) {
    if (path == null || path === "/dev/null") {
      return true;
    }
    let ignore = false;
    for (const entry of ignored) {
      if (entry.not) {
        if (path.match(entry.not.regex)) {
          return false;
        }
      } else if (!ignore && path.match(entry.regex)) {
        ignore = true;
      }
    }
    return ignore;
  }
  return isIgnored;
}

async function readFile(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, { encoding: "utf8" }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function getChangedLines(isIgnored, pullRequestFiles) {
  return pullRequestFiles
    .map(file =>
      isIgnored(file.previous_filename) && isIgnored(file.filename)
        ? 0
        : file.changes
    )
    .reduce((total, current) => total + current, 0);
}

function getSizeLabel(changedLines, sizes = defaultSizes) {
  let label = null;
  for (const lines of Object.keys(sizes).sort((a, b) => a - b)) {
    if (changedLines >= lines) {
      label = `size/${sizes[lines]}`;
    }
  }
  return label;
}

function getLabelChanges(newLabel, existingLabels) {
  const add = [newLabel];
  const remove = [];
  for (const existingLabel of existingLabels) {
    const { name } = existingLabel;
    if (name.startsWith("size/")) {
      if (name === newLabel) {
        add.pop();
      } else {
        remove.push(name);
      }
    }
  }
  return { add, remove };
}

function getSizesInput() {
  let inputSizes = process.env.INPUT_SIZES;
  if (inputSizes && inputSizes.length) {
    return JSON.parse(inputSizes);
  } else {
    return undefined;
  }
}

function getRunOnDraftInput() {
  const runOnDraft = process.env.INPUT_RUN_ON_DRAFT;
  if (runOnDraft === undefined || runOnDraft === null || runOnDraft === "") {
    return true; // Default to true
  }
  return runOnDraft.toLowerCase() === "true";
}

if (require.main === module) {
  main().then(
    () => (process.exitCode = 0),
    e => {
      process.exitCode = 1;
      console.error(e);
    }
  );
}

module.exports = {
  main,
  parseIgnored,
  actions,
  getSizeLabel,
  defaultSizes,
  getRunOnDraftInput
}; // exported for testing
