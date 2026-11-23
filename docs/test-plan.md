# Test Plan

## Scope

## Test levels

## Environments

## Risks and mitigations

## Phase 4 media verification

- Valid JPG, PNG, and WebP image data is accepted.
- Valid MP4 and WebM video data is accepted.
- Unsupported or mismatched media types are rejected.
- Image and video size limits are enforced by the API.
- Pending reports can replace or remove attached media.
- Approved and returned reports cannot be edited.
- Public listings expose media only for approved reports.

## Phase 5 search and categories

- Public search supports keyword, Lost/Found type, category, location, date range, sorting, and pagination.
- Approved reports only are returned.
- Category names are available to public browsing and report forms.
- Administrators and Super Administrators can create, rename, search, and delete unused categories.
- Duplicate category names are rejected.
- Categories used by reports cannot be deleted.
