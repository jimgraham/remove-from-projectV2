import { jest, test } from "@jest/globals";
import { Octokit } from "@octokit/core";
import { graphql } from "@octokit/graphql";

import { run } from "../src/run";

describe("run", () => {
  test("should remove the item from the project", async () => {
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
      itemId: 456,
      projectNumber: 1,
      graphqlWithAuth: mockGraphQLWithAuth as unknown as typeof graphql
    });
    expect(mockGraphQLWithAuth).toHaveBeenCalledWith(
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
