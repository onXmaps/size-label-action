# Changes Made: Added ready_for_review Action Support

## Summary

Added support for the `ready_for_review` GitHub pull request action to the size-label-action.

## Changes Made

### 1. Updated Actions Array (`index.js`)

- Added `"ready_for_review"` to the `actions` array
- The array now includes: `["opened", "synchronize", "reopened", "ready_for_review"]`

### 2. Updated Module Exports (`index.js`)

- Exported the `actions` array for testing purposes
- Updated export statement: `module.exports = { main, parseIgnored, actions }`

### 3. Added Comprehensive Tests (`index.test.js`)

- Added new test suite for the actions array
- Tests verify:
  - All expected actions are present
  - Exactly 4 actions are defined
  - `ready_for_review` action is specifically supported

## What this enables

When a draft pull request is marked as "ready for review", the GitHub action will now:

1. Calculate the size of changes in the PR
2. Apply the appropriate size label (XS, S, M, L, XL, XXL)
3. Remove any previous size labels if they existed

This ensures that PRs get properly labeled not just when opened or updated, but also when transitioning from draft to ready-for-review status.

## Testing

- All unit tests pass (15/15)
- Code compiles successfully with ncc
- The `ready_for_review` action is present in the compiled distribution

## Backward Compatibility

This change is fully backward compatible. Existing workflows will continue to work exactly as before, with the added benefit of supporting the ready_for_review action.
