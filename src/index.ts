import * as core from "@actions/core";
import * as github from "@actions/github";
import { Octokit } from "@octokit/core";
import { graphql } from "@octokit/graphql";

async function run(): Promise<void> {
  try {
    // Inputs and validation
    const issueNumber = Number(core.getInput("issue-number"));
    if (Number.isNaN(issueNumber)) {
      throw new Error("issue-number must be a number");
    }
    const token = core.getInput("token", { required: true });
    const projectNumber = Number(core.getInput("project-number", { required: true }));

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

    const octokit = new Octokit({
      auth: token
    });

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

    core.info(`${issue.pull_request ? "Issue" : "Pull request"} database ID: ${databaseId}`);

    const expectedType = issue.pull_request ? "PullRequest" : "Issue";

    const item = await getItem(projectOwner, projectNumber, token, expectedType, databaseId);
    if (!item) {
      core.info("Item not found in project");
      return;
    }
    // remove item from project
    core.info(`Removing ${item.fullDatabaseId} from the project`);
    await deleteItem(projectNumber, token, item.id);
    core.info("🚀 Card removed from project 🚀");
    return;
  } catch (error) {
    core.setFailed(`❌ Action failed with error: ${error}`);
  }
}

run();

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
  owner: string,
  project: number,
  token: string,
  expectedType: string,
  databaseId: number
): Promise<Item | null> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`
    }
  });

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

const DELELE_PROJECT_MUTATION = `mutation($projectID: ID!, $itemID: ID!) {
  deleteProjectV2Item(
    input: {
      projectId: $projectID,
      itemId: $itemID,
    }
  ) {
    deletedItemId
  }
}`;

async function deleteItem(project: number, token: string, itemID: string): Promise<void> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`
    }
  });

  await graphqlWithAuth(DELELE_PROJECT_MUTATION, {
    projectID: project,
    itemID: itemID
  });
}
