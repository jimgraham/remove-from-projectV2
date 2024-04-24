import * as core from "@actions/core";
import { graphql } from "@octokit/graphql";

interface Inputs {
  itemId: number;
  projectNumber: number;
  owner: string;
  graphqlWithAuth: typeof graphql;
}

export async function run(inputs: Inputs): Promise<void> {
  const itemId = inputs.itemId;
  const owner = inputs.owner;
  const projectNumber = inputs.projectNumber;
  const graphqlWithAuth = inputs.graphqlWithAuth;

  // fetch the project ID
  const projectID = await getProjectID(graphqlWithAuth, owner, projectNumber);

  // remove item from project (project number is not the same as project ID)
  core.info(`Removing ${itemId} from the project ${projectNumber}|${projectID}`);
  await deleteItem(graphqlWithAuth, projectID, itemId);
  core.info("🚀 Card removed from project 🚀");
  return;
}
interface OrgWithProjectV2 {
  organization: {
    name: string;
    projectV2: {
      id: string;
    };
  };
}

const GET_PROJECTV2_QUERY = `
query($organization: String!, $projectNumber: Int!) {
  organization(login: $organization)
  {
    projectV2(number: $projectNumber)
    {
      databaseId
    }
  }
}
`;

async function getProjectID(
  graphqlWithAuth: typeof graphql,
  organization: string,
  projectNumber: number
): Promise<string> {
  const result = await graphqlWithAuth<OrgWithProjectV2>(GET_PROJECTV2_QUERY, {
    organization: organization,
    projectNumber: projectNumber
  });
  return result.organization.projectV2.id;
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

async function deleteItem(graphqlWithAuth: typeof graphql, projectID: string, itemID: number): Promise<void> {
  await graphqlWithAuth(DELELE_PROJECT_MUTATION, {
    projectID: projectID,
    itemID: itemID
  });
}
