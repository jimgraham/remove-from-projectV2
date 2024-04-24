import { jest, test } from "@jest/globals";
import { graphql } from "@octokit/graphql";

import { run } from "../src/run";

describe("run", () => {
  test("should remove the item from the project", async () => {
    const mockGraphQLWithAuth = jest.fn();
    mockGraphQLWithAuth.mockReturnValue({
      organization: {
        projectV2: {
          id: "PJ_1"
        }
      }
    });

    await run({
      itemId: "PVTI_456",
      projectNumber: 1,
      owner: "octokit",
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
      { projectID: "PJ_1", itemID: "PVTI_456" }
    );
  });
});
