# size-label-action

GitHub action to assign labels based on pull request change sizes.

Labels are taken from https://github.com/kubernetes/kubernetes/labels?q=size

## ✨ Features

- **Automatic size labeling** based on lines changed in pull requests
- **Custom size thresholds** - define your own size categories
- **Comprehensive outputs** - access size, changed lines, and configuration data
- **Draft PR control** - choose whether to label draft pull requests
- **Smart file filtering** - ignore generated files, tests, and other non-essential changes
- **Multiple PR events** - supports opened, synchronize, reopened, and ready_for_review events

## Usage

Create a `.github/workflows/size-label.yml` file:

```yaml
name: size-label
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
jobs:
  size-label:
    permissions:
      contents: read
      pull-requests: write
    runs-on: ubuntu-latest
    steps:
      - name: size-label
        uses: "onXmaps/size-label-action@main"
        env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
```

## Create the needed labels

Export both `GITHUB_TOKEN` and `REPO` (e.g. `my-username/my-repository`) and run the script below:

```bash
for size in XL XXL XS S M L; do
  curl -sf -H "Authorization: Bearer $GITHUB_TOKEN" "https://api.github.com/repos/kubernetes/kubernetes/labels/size/$size" |
    jq '. | { "name": .name, "color": .color, "description": .description }' |
    curl -sfXPOST -d @- -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/repos/$REPO/labels
done
```

## Configuration

The following optional environment variables are supported:

- `IGNORED`: A list of [glob expressions](http://man7.org/linux/man-pages/man7/glob.7.html)
  separated by newlines. Files matching these expressions will not count when
  calculating the change size of the pull request. Lines starting with `#` are
  ignored and files matching lines starting with `!` are always included.
- `HTTPS_PROXY`: A proxy URL to pass to [https-proxy-agent](https://www.npmjs.com/package/https-proxy-agent)
  which will be used to proxy requests to the GitHub API.

You can configure the environment variables in the workflow file like this:

```yaml
env:
  GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
  IGNORED: |
    **/*.generated.*
    **/dist/**
    **/build/**
    **/*.min.js
    **/*.bundle.*
    **/node_modules/**
    **/*.lock
    **/package-lock.json
    **/yarn.lock
```

## Inputs

The action supports the following inputs:

- **`sizes`** (optional): Custom size configuration as a JSON object. See [Custom sizes](#custom-sizes) section below for details.
- **`run-on-draft`** (optional, default: `true`): Whether to run the action on draft pull requests. Set to `false` to skip labeling draft PRs, useful when you only want to label PRs that are ready for review.

## Custom sizes

The default sizes are:

```js
{
  "0": "XS",
  "10": "S",
  "30": "M",
  "100": "L",
  "500": "XL",
  "1000": "XXL"
}
```

You can pass your own configuration by passing `sizes` and other inputs:

```yaml
name: size-label
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
jobs:
  size-label:
    permissions:
      contents: read
      pull-requests: write
    runs-on: ubuntu-latest
    steps:
      - name: size-label
        uses: "onXmaps/size-label-action@main"
        env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
          IGNORED: |
            **/test/**
            **/tests/**
            **/*.test.*
            **/*.spec.*
            **/docs/**
            **/*.md
        with:
          sizes: >
            {
              "0": "XS",
              "20": "S",
              "50": "M",
              "200": "L",
              "800": "XL",
              "2000": "XXL"
            }
          run-on-draft: false
```

## Outputs

The action provides the following outputs that you can use in subsequent workflow steps:

- **`size-label`**: The full size label that was applied (e.g., `size/XL`)
- **`size`**: The size value without the `size/` prefix (e.g., `XL`)
- **`changed-lines`**: The total number of changed lines in the pull request
- **`is-custom-sizes`**: Whether custom sizes were used (`true`/`false`)
- **`sizes-config`**: The size configuration that was used (JSON string)

These outputs enable powerful workflow automation based on PR size.

## Supported Events

The action responds to the following pull request events:

- **`opened`**: When a new pull request is created
- **`synchronize`**: When new commits are pushed to the pull request
- **`reopened`**: When a previously closed pull request is reopened
- **`ready_for_review`**: When a draft pull request is marked as ready for review

This ensures your PRs get properly labeled throughout their lifecycle.

## Using with other actions

You can use the outputs to conditionally run jobs based on PR size:

```yaml
name: size-label-and-notify
on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
jobs:
  size-label:
    permissions:
      contents: read
      pull-requests: write
    runs-on: ubuntu-latest
    outputs:
      size: ${{ steps.size-label.outputs.size }}
      changed-lines: ${{ steps.size-label.outputs.changed-lines }}
    steps:
      - name: size-label
        id: size-label
        uses: "onXmaps/size-label-action@main"
        env:
          run-on-draft: false
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
          IGNORED: |
            **/test/**
            **/docs/**
            **/*.md
        with:
          sizes: >
            {
              "0": "XS",
              "20": "S", 
              "50": "M",
              "200": "L",
              "800": "XL",
              "2000": "XXL"
            }

  notify-large-pr:
    runs-on: ubuntu-latest
    needs: size-label
    if: contains(fromJSON('["XL", "XXL"]'), needs.size-label.outputs.size)
    steps:
      - name: Notify on large PR
        run: |
          echo "🚨 Large PR detected!"
          echo "Size: ${{ needs.size-label.outputs.size }}"
          echo "Changed lines: ${{ needs.size-label.outputs.changed-lines }}"
          # Add your notification logic here (Slack, email, etc.)

  comment-on-huge-pr:
    runs-on: ubuntu-latest
    needs: size-label
    if: needs.size-label.outputs.size == 'XXL'
    steps:
      - name: Comment on XXL PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ This is an **XXL** sized PR with ${{ needs.size-label.outputs.changed-lines }} changed lines. Consider breaking it into smaller PRs for easier review.'
            })
```

## Legacy Output Support

For backward compatibility, the action still supports the legacy `sizeLabel` output, but it's recommended to use the new outputs listed above.

## License

[MIT](LICENSE)
