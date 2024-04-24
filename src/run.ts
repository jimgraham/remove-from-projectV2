import * as core from "@actions/core";
import { graphql } from "@octokit/graphql";

interface Inputs {
  itemId: number;
  projectNumber: number;
  graphqlWithAuth: typeof graphql;
}

export async function run(inputs: Inputs): Promise<void> {
  const itemId = inputs.itemId;
  const projectNumber = inputs.projectNumber;
  const graphqlWithAuth = inputs.graphqlWithAuth;

  // remove item from project
  core.info(`Removing ${itemId} from the project ${projectNumber}`);
  await deleteItem(graphqlWithAuth, projectNumber, itemId);
  core.info("🚀 Card removed from project 🚀");
  return;
}

const DELELE_PROJECT_MUTATION = `
mutation($projectID: ID!, $itemID: ID!) {
  deleteProjectV2Item(
    input: {
      projectId: $projectID,
      itemId: $itemID,
    }
  ) {
    deletedItemId
  }
}
`;

async function deleteItem(graphqlWithAuth: typeof graphql, project: number, itemID: number): Promise<void> {
  await graphqlWithAuth(DELELE_PROJECT_MUTATION, {
    projectID: project,
    itemID: itemID
  });
}
