import { jest, test } from "@jest/globals";
import { Octokit } from "@octokit/core";
import { graphql } from "@octokit/graphql";

import { run } from "../src/run";

const mockRequest = jest.fn();
const MOCTOKIT = {
  request: mockRequest
};

const moctokit = MOCTOKIT as unknown as Octokit;
const inputs = {
  issueNumber: 1,
  projectNumber: 1,
  projectOwner: "octocat",
  issueOwner: "jimgraham",
  issueRepository: "remove-from-projectV2",
  octokit: moctokit,
  graphqlWithAuth: jest.fn() as unknown as typeof graphql
};

describe("run", () => {
  test("should query the issue", async () => {
    await run(inputs);
    expect(mockRequest).toHaveBeenCalledWith("GET /repos/{owner}/{repo}/issues/{issue_number}", {
      owner: "jimgraham",
      repo: "remove-from-projectV2",
      issue_number: 1
    });
  });

  test("should query the pull request if necessary", async () => {
    mockRequest.mockReturnValue({ data: { pull_request: true } });

    await run(inputs);

    expect(mockRequest).toHaveBeenCalledWith("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
      owner: "jimgraham",
      repo: "remove-from-projectV2",
      pull_number: 1
    });
  });

  test("should get the item from the project", async () => {
    const mockGraphQLWithAuth = jest.fn();

    await run({
      issueNumber: 1,
      projectNumber: 1,
      projectOwner: "octocat",
      issueOwner: "jimgraham",
      issueRepository: "remove-from-projectV2",
      octokit: moctokit,
      graphqlWithAuth: mockGraphQLWithAuth as unknown as typeof graphql
    });
    expect(mockGraphQLWithAuth).toHaveBeenCalledWith(
      `
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
`,
      {
        organization: "octocat",
        projectNumber: 1,
        cursor: null
      }
    );
  });

  test("should remove the item from the project", async () => {
    mockRequest.mockReturnValue({ data: { pull_request: false, id: "ID_foobar" } });
    const mockGraphQLWithAuth = jest.fn();
    mockGraphQLWithAuth.mockReturnValue({
      organization: {
        projectV2: {
          items: {
            totalCount: 1,
            edges: [{ node: { content: { __typename: "Issue", fullDatabaseId: "ID_foobar", id: 456 } } }],
            pageInfo: {
              hasNextPage: false
            }
          }
        }
      }
    });

    await run({
      issueNumber: 1,
      projectNumber: 1,
      projectOwner: "octocat",
      issueOwner: "jimgraham",
      issueRepository: "remove-from-projectV2",
      octokit: moctokit,
      graphqlWithAuth: mockGraphQLWithAuth as unknown as typeof graphql
    });
    expect(mockGraphQLWithAuth).toHaveBeenNthCalledWith(
      2,
      `
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
`,
      { projectID: 1, itemID: 456 }
    );
  });
});
