import * as core from "@actions/core";
import * as github from "@actions/github";
import { graphql } from "@octokit/graphql";

import { run } from "./run";

async function main(): Promise<void> {
  const issueNumber = Number(core.getInput("issue-number"));
  if (Number.isNaN(issueNumber)) {
    throw new Error("issue-number must be a number");
  }
  const currentRepository = github.context.payload.repository;
  const projectOwner = core.getInput("project-owner") || currentRepository?.owner.login;
  if (!projectOwner) {
    throw new Error("project-owner must be specified, unable to determine from context");
  }

  const issueOwner = core.getInput("issue-owner") || currentRepository?.owner.login;
  const issueRepository = core.getInput("issue-repository") || currentRepository?.name;
  if (!issueOwner || !issueRepository) {
    throw new Error("issue-owner and issue-repository must be set, unable to determine from context");
  }
  const token = core.getInput("token", { required: true });

  await run({
    issueNumber: issueNumber,
    issueOwner: issueOwner,
    issueRepository: issueRepository,
    projectNumber: Number(core.getInput("project-number", { required: true })),
    projectOwner: projectOwner,
    octokit: github.getOctokit(token),
    graphqlWithAuth: graphql.defaults({
      headers: {
        authorization: `token ${token}`
      }
    })
  });
}

main().catch(mainError => core.setFailed(mainError instanceof Error ? mainError.message : JSON.stringify(mainError)));
