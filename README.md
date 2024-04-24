# Remove from `ProjectV2`

An action to remove an issue from a V2 project board.

This is based directly on [Remove from project (classic)](https://github.com/joshmgross/remove-from-project-classic). Reworked based on MIT license.

## Inputs

* `item-id` - The ID of the card to remove
* `project-number` - The number of the project board
* `token` - An authentication token with access to the project board and issue/pull request

## Usage

### Remove an item from a project

```yaml
- uses: jimgraham/remove-from-projectV2@main
  with:
    project-number: 123
    item-id: 456
    token: ${{ secrets.PROJECT_TOKEN }}
```

### Remove an item after finding it on the board

```yaml
- uses: jimgraham/find-in-projectV2@main
  id: find-in-project
  with:
    project-owner: github
    project-number: 456
    issue-number: 16
    token: ${{ secrets.PROJECT_TOKEN }}
- uses: jimgraham/remove-from-projectV2@main
    if: steps.find-in-project.outputs.itemId != null
    with:
      github-token: ${{ secrets.SHOPIFY_GH_ACCESS_TOKEN }}
      project-number: ${{ env.PROJECT_ID }}
      project-owner: github
      project-number: 456
      project-item-id: ${{ steps.add_to_project.outputs.itemId }}
- uses: jimgraham/remove-from-projectV2@main
  with:
    project-number: 123
    item-id: 456
    token: ${{ secrets.PROJECT_TOKEN }}
```

### Remove an issue from a separate repository

```yaml
- uses: jimgraham/remove-from-projectV2@main
  with:
    project-number: 123
    issue-owner: actions
    issue-repository: cache
    issue-number: 32
    token: ${{ secrets.PROJECT_TOKEN }}
```
