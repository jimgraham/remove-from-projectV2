import * as core from "@actions/core";
import { graphql } from "@octokit/graphql";

import { run } from "./run";

async function main(): Promise<void> {
  const token = core.getInput("token", { required: true });

  await run({
    itemId: Number(core.getInput("item-id", { required: true })),
    projectNumber: Number(core.getInput("project-number", { required: true })),
    graphqlWithAuth: graphql.defaults({
      headers: {
        authorization: `token ${token}`
      }
    })
  });
}

main().catch(mainError => core.setFailed(mainError instanceof Error ? mainError.message : JSON.stringify(mainError)));
