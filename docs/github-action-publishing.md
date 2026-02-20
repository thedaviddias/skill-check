# GitHub Action Publishing

Current decision: defer GitHub Marketplace listing until there is clear demand.

Use direct action references today:

- `uses: thedaviddias/skill-check@v1`
- `uses: thedaviddias/skill-check@v1.x.y`

## Ready Now Checklist

- `action.yml` exists and documents all inputs/outputs.
- `github-action/index.js` is present and executable by `runs.using: node20`.
- README and quickstart examples are up to date and copy/paste-valid.
- A stable major tag strategy is defined (`v1` moving tag + immutable `v1.x.y` tags).

## Future Marketplace Publication Steps

1. Choose listing repository strategy.
Recommended: dedicated lightweight wrapper repo for Marketplace listing while keeping this repo as CLI source of truth.
2. Confirm action metadata and branding are complete (`name`, `description`, `author`, `branding`).
3. Create immutable version tag (for example `v1.2.0`) and push it.
4. Move/update the major tag (`v1`) to the release commit.
5. Create a GitHub Release for the published tag.
6. Submit the action to GitHub Marketplace via the GitHub listing flow.

## Operational Notes

- Keep direct `uses:` references as baseline distribution.
- Before moving the major tag, validate docs and examples against current action inputs.
- Keep runtime behavior stable within the same major version.
