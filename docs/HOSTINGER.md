# Hostinger Business deployment

**Live deployment, 16 October 2026:** https://edgedirect2u.com uses Node 24, Next.js, `npm run build:hostinger` and output `.next`. The build uses Webpack because Turbopack's CSS subprocess could not start on this host. Seven environment settings are stored privately, including the primary origin, public Supabase configuration, service/payment keys, `LOCAL_DEMO=false` and `HOSTNAME=0.0.0.0`. The customer directory shows 3,456 imported records and the complete product administration controls are live. This is a source ZIP deployment; GitHub auto-deploy is active on Vercel, not this Hostinger site. The primary domain and HTTPS are connected.

Hostinger currently documents Node.js Web Apps on Business and Cloud plans, including Next.js and Node 24. Deploy through that facility in hPanel. This app needs a Node server for authentication, payment APIs and server rendering. [Hostinger Node.js setup](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

## Prepare the release

1. Configure staging Supabase and Paystack using the accompanying guides.
2. Run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build:hostinger`. Browser tests own an isolated development server. Run `npm run check:production` to verify the packaged server against the configured database.
3. Configure server environment values in Hostinger. Set `LOCAL_DEMO=false`, all Supabase keys, the Paystack secret, and `NEXT_PUBLIC_SITE_URL=https://edgedirect2u.com`. A random `CRON_SECRET` of at least 32 characters is only needed for the optional HTTP scheduler; the connected project's database scheduler is already enabled.
4. Check equivalent local release values with `npm run check:env`. This validates configuration presence, not connectivity.

## Deploy from GitHub

GitHub migration preparation, 17 October 2026: the existing ZIP site's dashboard did not expose a source-switch action. A separate Node app onboarding was opened on a temporary domain while the original domain stays live. Choose the existing `Bluechipwhale/edgedirect2u` repository rather than creating a fork. Confirm the build and private environment values below, verify the temporary app, then transfer the canonical domain while preserving email DNS. A successful authorization is not evidence of a successful deployment: verify its commit, build status, live health response and staff controls. Do not remove the working site or its mailbox as an onboarding shortcut.

Connect `https://github.com/Bluechipwhale/edgedirect2u` through **Web App → Import Git Repository**, select the `main` branch and repository root, and use the build settings below. Authorize Hostinger's GitHub access if prompted. The `build:hostinger` command generates an ignored `.env.production` from `config/hostinger-public.json`, so GitHub deployments use the same Supabase project and domain as the prepared ZIP without committing environment files. Set `HOSTNAME=0.0.0.0` in Hostinger and leave its assigned `PORT` unchanged.

Store `SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` only in Hostinger environment settings. Future commits pushed to the connected branch can trigger Hostinger rebuilds through its GitHub integration. The included GitHub Actions workflow checks each push and pull request; it does not deploy or apply database migrations. Apply future forward migrations deliberately with `npm run db:plan` and `npm run db:migrate` from a trusted machine, then deploy code that needs them.

## Build settings

Create a Node.js Web App from the source repository or source ZIP. Select Next.js, Node **24**, repository root directory, install command `npm ci --include=dev`, build command `npm run build:hostinger`, and start command `node --use-system-ca .next/standalone/server.js`. Choose `.next` when an output directory is requested. Build dependencies are required to compile TypeScript and CSS; the standalone runtime uses the traced production dependencies.

If the deployment screen requests an entry file instead of a start command, use `.next/standalone/server.js`. The packaging script copies `public` and `.next/static` into that directory. Use the host-assigned `PORT`.

Keep `package-lock.json`. Upload source, public assets and package metadata. Exclude secret `.env` files, `node_modules`, `.data`, `.git`, screenshots and test results. The architecture assumes managed Supabase persistence, with no dependency on Docker, Redis, root access or persistent local application files.

The owner confirmed Hostinger and `edgedirect2u.com`. The prepared `artifacts/hostinger-source.zip` contains source at the archive root and excludes server secrets and generated output. A generated `.env.production` contains the final domain, the supplied Supabase URL/publishable key and `LOCAL_DEMO=false`. Next.js loads it automatically during Hostinger's build and runtime. The same public settings are recorded in `config/hostinger-public.json`; no database password or service-role key is embedded. Hostinger reads the existing Supabase database over HTTPS; no database export or import is needed.

Upload this source ZIP through **Web App → Upload your website files** using the settings above. Hostinger builds Linux output from the source; do not upload a Windows-generated standalone directory. Use the host-assigned `PORT` and `HOSTNAME=0.0.0.0` if binding is requested. Leave obsolete/blank `NEXT_PUBLIC_*` overrides out of hPanel because host environment variables take precedence over the file. Recreate the ZIP on Windows with `powershell -NoProfile -File scripts/package-hostinger.ps1`. Its SHA-256 checksum is written alongside it.

After attaching the domain, open `https://edgedirect2u.com/api/health`. A 200 response with `status: "ok"` confirms the deployed server can read published settings from Supabase. Sign in at `/login` with `olasodechukwudi@gmail.com`, which now has administrator access, then open `/admin`. Products created there persist in the same Supabase database and active products appear on the storefront. Published, unarchived products from approved merchants appear in the catalogue; drafts remain hidden. The homepage has its own product selection described in HOMEPAGE-PRODUCTS.md.

Add `SUPABASE_SERVICE_ROLE_KEY` and `PAYSTACK_SECRET_KEY` privately through Hostinger environment settings, then redeploy. Checkout needs both. Public catalogue reads, ordinary authenticated administration and raster image uploads through existing admin Storage policies do not require the service-role key. Configure Supabase Auth Site URL as `https://edgedirect2u.com` and permit `https://edgedirect2u.com/auth/confirm` (including recovery query parameters). Use the email templates in `LAUNCH.md`. This app supports the webhook endpoint `https://edgedirect2u.com/api/payments/webhook`. The owner also uses this Paystack account for an existing WooCommerce store: preserve its shared webhook routing. Checkout return verification is server-side; do not replace the other store's webhook as part of a routine website deployment.

Inspect logs and the temporary preview URL. Verify administrator routes require authentication and local demo access is disabled.

## Domain and HTTPS

Attach `edgedirect2u.com` in the app’s domain settings and follow the DNS values shown by hPanel. Preserve email DNS records. Enable its SSL certificate and HTTPS redirection; redirect `www` to your canonical origin. Rebuild when `NEXT_PUBLIC_*` values change. Update Supabase Site URL/redirects and Paystack’s webhook when moving from staging. [Domain connection guide](https://www.hostinger.com/support/how-to-connect-a-custom-domain-to-a-node-js-application/).

## Acceptance and operation

On HTTPS, test registration, sign-in/out, a Storage logo upload, theme draft isolation, publishing and rollback. Use Paystack test mode until financial acceptance passes. Approve merchant applications and verify two merchants cannot read one another’s private records. Add a driver and complete dispatch with recipient confirmation. Verify records and assets survive a redeployment. Configure and test reservation expiry scheduling.

Theme settings are server-loaded per render. Private routes and APIs send no-store headers; host/CDN rules must preserve them. Monitor process limits and image processing resource use.

The primary Hostinger domain and Supabase SMTP configuration are complete. The owner confirmed receipt of recovery email. Shared Paystack webhook routing, real payment/refund acceptance, catalogue approval and the outstanding modules in `LEGACY-PARITY.md` remain commissioning work. After uploading a new archive, verify that the live pages actually contain the new controls; a successful rebuild of **Use previous files** can still serve old code.
