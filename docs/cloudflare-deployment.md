# Cloudflare deployment

Production is hosted on Cloudflare Workers at https://qr.vwave.me. The Worker
name, static asset directory, and custom domain are configured in
`wrangler.jsonc`.

Use Cloudflare Workers Builds to connect `VesselWave/mini-qr` directly to the
`mini-qr` Worker. Configure the production branch as `main` and enable builds
for other branches. Production builds deploy to the custom domain.

## Build settings

In the Worker's **Settings > Builds**, use these settings:

- Root directory: repository root
- Build command: `bun install --frozen-lockfile --ignore-scripts && BASE_PATH=/ bun run build`
- Deploy command: `bunx wrangler@4.142.0 deploy`
- Preview command: `bunx wrangler@4.142.0 preview`
- Build variable `BUN_VERSION`: `1.4.2`
- Build variable `SKIP_DEPENDENCY_INSTALL`: `true`

Cloudflare manages GitHub access and the deployment token through the dashboard.
The build command installs dependencies with Bun using the committed `bun.lock`.
Skipping automatic dependency installation prevents the build image from
selecting a different package manager from the upstream repository's settings.

## Local deployment

```sh
bun install --frozen-lockfile --ignore-scripts
BASE_PATH=/ bun run build
bunx wrangler@4.142.0 deploy
```

Wrangler must be logged in locally, or `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` must be set in the local environment.
