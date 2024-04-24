import * as core from "@actions/core";
import * as github from "@actions/github";
import { graphql } from "@octokit/graphql";

import { run } from "./run";

async function main(): Promise<void> {
  const token = core.getInput("token", { required: true });

  const currentRepository = github.context.payload.repository;
  const owner = core.getInput("project-owner") || currentRepository?.owner.login;
  if (!owner) {
    throw new Error("project-owner must be specified, unable to determine from context");
  }

  await run({
    itemId: Number(core.getInput("item-id", { required: true })),
    owner: owner,
    projectNumber: Number(core.getInput("project-number", { required: true })),
    graphqlWithAuth: graphql.defaults({
      headers: {
        authorization: `token ${token}`
      }
    })
  });
}

main().catch(mainError => core.setFailed(mainError instanceof Error ? mainError.message : JSON.stringify(mainError)));
