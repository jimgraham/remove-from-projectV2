import * as core from "@actions/core";
import { Octokit } from "@octokit/core";
import { graphql } from "@octokit/graphql";

interface Inputs {
  issueNumber: number;
  projectNumber: number;
  projectOwner: string;
  issueOwner: string;
  issueRepository: string;
  octokit: Octokit;
  graphqlWithAuth: typeof graphql;
}

export async function run(inputs: Inputs): Promise<void> {
  try {
    const issueNumber = inputs.issueNumber;
    const projectNumber = inputs.projectNumber;
    const projectOwner = inputs.projectOwner;
    const issueOwner = inputs.issueOwner;
    const issueRepository = inputs.issueRepository;
    const octokit = inputs.octokit;
    const graphqlWithAuth = inputs.graphqlWithAuth;

    // https://docs.github.com/en/rest/issues/issues#get-an-issue
    const issue = (
      await octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        owner: issueOwner,
        repo: issueRepository,
        issue_number: issueNumber
      })
    ).data;

    let databaseId = issue.id;

    // If the issue is a pull request, we need to get the database ID of the pull request
    if (issue.pull_request) {
      // https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
      const pr = (
        await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
          owner: issueOwner,
          repo: issueRepository,
          pull_number: issueNumber
        })
      ).data;
      databaseId = pr.id;
    }

    const expectedType = issue.pull_request ? "PullRequest" : "Issue";
    core.info(`Type: ${expectedType} database ID: ${databaseId}`);
    console.log(`Type: ${expectedType} database ID: ${databaseId}`);

    const item = await getItem(graphqlWithAuth, projectOwner, projectNumber, expectedType, databaseId);
    if (!item) {
      core.info("Item not found in project");
      return;
    }
    // remove item from project
    core.info(`Removing ${item.fullDatabaseId} from the project`);
    await deleteItem(graphqlWithAuth, projectNumber, item.id);
    core.info("🚀 Card removed from project 🚀");
    return;
  } catch (error) {
    core.setFailed(`❌ Action failed with error: ${error}`);
  }
}

// Update to projectsV2
interface OrgWithProjectV2 {
  organization: {
    name: string;
    projectV2: {
      databaseId: number;
      items: {
        totalCount: number;
        edges: [
          {
            node: {
              content: {
                __typename: "Issue" | "PullRequest";
                fullDatabaseId: string;
                number: number;
                id: string;
              };
            };
          }
        ];
        pageInfo: {
          endCursor: string;
          hasNextPage: boolean;
        };
      };
    };
  };
}

interface Item {
  __typename: "Issue" | "PullRequest";
  fullDatabaseId: string;
  id: string;
  number: number;
}

const GET_ITEMS_PAGINATED_QUERY = `
query($organization: String!, $projectNumber: Int!, $cursor: String) {
  organization(login: $organization)
  {
    projectV2(number: $projectNumber)
    {
      databaseId
      items (first: 100, after: $cursor)
      {
        totalCount
        edges{
          node{
            content{
              __typename
              ... on Issue {
                fullDatabaseId
                number
                id
              }
              ... on PullRequest {
                fullDatabaseId
                number
                id
              }
            }
          }
        }
        pageInfo{
          endCursor
          hasNextPage
        }
      }
    }
  }
}
`;

async function getItem(
  graphqlWithAuth: typeof graphql,
  owner: string,
  project: number,
  expectedType: string,
  databaseId: number
): Promise<Item | null> {
  let hasNextPage = true;
  let cursor = null;
  while (hasNextPage) {
    const resp: OrgWithProjectV2 = await graphqlWithAuth(GET_ITEMS_PAGINATED_QUERY, {
      organization: owner,
      projectNumber: project,
      cursor: cursor
    });

    hasNextPage = resp.organization.projectV2.items.pageInfo.hasNextPage;
    cursor = resp.organization.projectV2.items.pageInfo.endCursor;

    for (const edge of resp.organization.projectV2.items.edges) {
      // Issues on the board may not be accessible from this repository
      if (edge.node == null || edge.node.content == null) {
        continue;
      }
      core.info(`Checking item: ${edge.node.content}`);
      if (edge.node.content.__typename === expectedType && edge.node.content.fullDatabaseId === databaseId.toString()) {
        core.info(`Item found: ${edge.node.content.fullDatabaseId}`);
        return {
          __typename: edge.node.content.__typename,
          fullDatabaseId: edge.node.content.fullDatabaseId,
          id: edge.node.content.id,
          number: edge.node.content.number
        };
      }
    }
  }
  return null;
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

async function deleteItem(graphqlWithAuth: typeof graphql, project: number, itemID: string): Promise<void> {
  await graphqlWithAuth(DELELE_PROJECT_MUTATION, {
    projectID: project,
    itemID: itemID
  });
}
