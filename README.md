# Admin login

- **Requested email:** `aurelia@admin.com`
- **Password:** Not configured; administrator creation has not been confirmed.
- **Local login URL:** http://localhost:5173/admin (after `npm run dev` starts).

Set a unique password of at least 12 characters as `ADMIN_PASSWORD` in the ignored `.env`, then run `npm run create-admin` from your normal Mac Terminal. The script preserves existing admin accounts. Keep the password out of this README so it is not committed to GitHub.

---

# Aurelia Estates

A single-project React/Vite and Express/Mongoose real estate platform. The public website shows published properties from MongoDB Atlas. Visitors can search, open property pages, and submit inquiries. Authorized administrators can manage listings, inquiries, and agency content. Property images upload directly to Cloudinary after the API signs each upload.

**Aurelia Estates is a temporary brand.** Replace the name, logo, contact details, About copy, and services in **Admin → Site settings** with verified client information before launch. The legal pages are drafts for client and legal review.

## Architecture

- `src/`: React website and dashboard
- `api/index.js`: Express app exported as one Vercel Function
- `api/models/`: MongoDB Property, Inquiry, Admin, and Site Settings models
- `scripts/`: intentional admin provisioning and demonstration-data utilities
- `vercel.json`: API rewrite first, then Vite SPA fallback

The frontend calls same-origin `/api/*` URLs. In development, Vite proxies those to Express on port 3001. Vercel deploys the API and the built Vite assets from the same repository and project. The API caches a Mongoose connection across warm invocations; it stores no persistent data on the function filesystem.

## Local installation

1. Install Node.js 20 or newer. In this folder, run `npm install`.
2. Create a MongoDB Atlas cluster, a database user with read/write access to the application database, and an Atlas network access rule for your local machine. Put the connection string in `.env` as `MONGODB_URI`. Use an explicit database name in the URI, such as `/aurelia`.
3. Create a Cloudinary account for real property image uploads. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to `.env`. No unsigned browser upload preset is required. The server signs uploads only for an authenticated administrator.
4. Copy `.env.example` to `.env` if you do not already have an ignored local `.env`. Set `JWT_SECRET` to a unique random string of at least 32 characters. Never use the example values as credentials. **A local ignored `.env` is already configured with the MongoDB URI supplied during development; it is not committed to source control. Rotate that database password before real use.**
5. Run `npm run dev`. Vite serves the frontend, and Express serves the API. Open the URL shown by Vite. Check `/api/health`.
6. Run `npm run build` for a production frontend build. `npm test` runs the tests that do not need external services.

### Create the first administrator

Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters in `.env`, then run `npm run create-admin`. This creates an administrator in MongoDB with a bcrypt password hash only when no administrator exists. It never changes an existing account or password. Remove `ADMIN_PASSWORD` from `.env` after provisioning; the running app does not use it. There is no public registration route or default password. Log in through **Admin Login** in the footer at `/admin`.

### Demonstration properties

Run `CONFIRM_DEMO_SEED=yes npm run seed` to insert 30 clearly labeled **fictional demonstration properties** into the actual MongoDB database. The script uses unique slugs and inserts only missing records; it does not modify existing listings. Demo cards and detail pages say they are fictional and unavailable. Images are illustrative Unsplash photography, not verified photographs of the fictional addresses.

To remove **only** records marked `isDemo: true`, run `CONFIRM_REMOVE_DEMO=yes npm run remove-demo`. Do this only after reviewing any edits you made to demo records, since this removes those records. Neither script runs automatically on application startup or deployment. Replace demo records with genuine listings through the dashboard before a real launch.

## What the administrator can do

- Review database-derived property and inquiry counts on the overview.
- Search, create, edit, preview, publish, unpublish, feature, and delete properties.
- Upload multiple photographs directly to Cloudinary, see progress, select a cover, reorder, and remove images.
- Review inquiries, follow the related property link, change follow-up status, search and filter, and delete after confirmation.
- Edit agency name, tagline, verified contact details, logo URL, About copy, services, and social links. Public pages fetch those settings from MongoDB.

The dashboard requires a signed HttpOnly cookie and server-side account verification. Its APIs check authorization independently of the frontend.

## Public pages

`/`, `/properties`, `/properties/:slug`, `/about`, `/services`, `/contact`, `/privacy`, `/terms`, and a 404 page. Public listing APIs only return published properties. Searches and filters use URL query parameters and database queries. Contact and property inquiry forms save submissions to MongoDB and confirm success only after the API responds successfully.

## API routes

Public: `GET /api/health`, `GET /api/settings`, `GET /api/properties`, `GET /api/properties/featured`, `GET /api/properties/:slug`, `POST /api/inquiries`.

Admin: `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/me`, `GET /api/admin/dashboard`, property CRUD under `/api/admin/properties`, inquiry list/update/delete under `/api/admin/inquiries`, `GET`/`PUT /api/admin/settings`, and `POST /api/admin/uploads/sign`.

Property filters: `search`, `city`, `type`, `listingStatus`, `minPrice`, `maxPrice`, `beds`, `baths`, `sort`, `page`, and `limit`.

## Environment variables

| Variable | Use |
| --- | --- |
| `MONGODB_URI` | Atlas connection string, with a database name. Required for data operations. |
| `JWT_SECRET` | Random session signing secret of at least 32 characters. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name. |
| `CLOUDINARY_API_KEY` | Cloudinary public API key, used in signed upload configuration. |
| `CLOUDINARY_API_SECRET` | Private signing secret; server only. |
| `ADMIN_EMAIL` | Used by the administrator creation script only. |
| `ADMIN_PASSWORD` | Used by the administrator creation script only; remove after use. |
| `PORT` | Local Express port, defaults to 3001. |
| `NODE_ENV` | Set to `production` for secure production cookies. |

Do not prefix secrets with `VITE_`. `.env` and `.env.*` are ignored except `.env.example`.

## One-project Vercel deployment

1. Push this project root to a single GitHub repository. Do not add `.env`.
2. Import the repository as one Vercel project. Use the Vite framework preset, root directory at the repository root, build command `npm run build`, and output directory `dist`.
3. Set `MONGODB_URI`, `JWT_SECRET`, and the three Cloudinary variables in Vercel Environment Variables. Configure Atlas network access for Vercel's database connections. Set `NODE_ENV=production` if needed.
4. Deploy. Verify `/api/health`, `/api/properties`, `/api/settings`, and a refreshed deep link such as `/properties`.
5. Provision the first admin by running the local `create-admin` script against the production Atlas database, using a unique admin password. Remove the password from local `.env` after use.
6. Log in, create a draft, upload photographs, publish it, and verify the public listing and inquiry form. Check the inquiry in the dashboard. Replace all demo content and draft legal text before client launch.

## Security and operational limits

Password hashes use bcrypt. Admin sessions use signed JWTs in `HttpOnly`, `SameSite=Strict` cookies; production cookies are `Secure`. Write requests check their origin. The API validates inputs, checks object IDs, hides internal errors from responses, and sends basic security headers. Public routes enforce publication status at the database query. CORS is not enabled because frontend and API share one origin.

The included Express rate limiters are per function instance. Add a shared rate limiter or Vercel Firewall rules for login and inquiry abuse protection across a production deployment. Cloudinary assets uploaded but never saved with a listing can remain orphaned; inspect and clean these periodically. Image cleanup after property edits or deletion is best effort, and failures are logged. Confirm licensing and accuracy for all production images and property details.

## Verification status in this workspace

`npm run build` and `npm test` pass. The API's health, invalid inquiry, invalid login, and unauthenticated admin paths were tested without binding a port. Atlas DNS lookup fails from this restricted environment, so database CRUD, admin sign-in, seed, and inquiry persistence could not be run against the supplied cluster here. Cloudinary credentials were not provided, so real uploads could not be tested. This environment also rejects localhost server ports (`EPERM`), so interactive browser and mobile testing and Vercel deployment were not performed. Those are required checks before a client demonstration.

## MongoDB connection diagnosis on your Mac

Run `npm run diagnose:mongo` from this project in **your normal macOS Terminal**, outside a restricted agent session. The command reads this project's `.env` by path, checks URI syntax without printing credentials, tests a control DNS name, looks up Atlas SRV/TXT records, resolves any returned node hosts, checks their TCP ports, and performs a read-only MongoDB `ping`. It prints error codes and stages, never the full URI or password. `npm run create-admin` must wait until `MONGODB_DRIVER CONNECTED` appears.

Interpret the results in order:

- `CONTROL_DNS_A FAIL`: the local resolver or network cannot perform ordinary DNS; try a different network or DNS resolver, and check VPN/firewall settings.
- Control DNS works but `ATLAS_SRV FAIL`: verify the hostname by copying a fresh connection string from Atlas **Connect → Drivers**. Use a DNS resolver that supports SRV records, or obtain the non-SRV connection string from that Atlas dialog.
- SRV records resolve but `NODE_TCP` fails: check **Atlas → Network Access** for your Mac's current public IP and allow outbound TCP to the listed node ports (normally 27017) through your Mac/network firewall.
- DNS and TCP pass but the driver reports authentication failure: then check the Atlas database user and password. This is a later stage than the current `querySrv ECONNREFUSED` failure.
- An IPv6-only TCP failure after successful SRV and node DNS checks could justify testing the MongoDB driver's `family: 4` option. The current failure is at SRV DNS lookup, so the application does not force IPv4.

This Codex session is restricted: generic DNS lookups and socket creation fail here, so its `ECONNREFUSED` is **not evidence** that your normal Mac or Atlas cluster is unable to connect. Do not paste the diagnostic output if it contains any credentials from a modified script. Rotate credentials previously shared in chat before production use.

## Local administrator login

The local login URL is **http://localhost:5173/admin** once `npm run dev` is running. Vite uses port 5173 with strict port checking. Its API proxy preserves the browser Host header for the API origin check.

The requested admin email is `aurelia@admin.com`; this does not confirm that the account exists yet. Admin email and password are read from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the ignored project `.env`. Passwords are intentionally absent from this README and must never be committed. Choose a unique password of at least 12 characters.

1. Run `npm run create-admin -- --check` in your normal Mac Terminal. It reports only whether an account exists.
2. If no account exists, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` privately in `.env`, then run `npm run create-admin`. Existing accounts are preserved.
3. Start `npm run dev`, then run `npm run verify-admin` in another terminal. It tests login through Vite, the session cookie, `/api/admin/me`, and logout without printing credentials or tokens.
4. Remove `ADMIN_PASSWORD` from `.env` after verification. Use the saved private password to sign in at the URL above.

If an admin already exists, use its existing credentials. The setup script does not reset its password.

### Diagnose an invalid admin login

Run `npm run check-admin` in your normal Mac Terminal. It performs read-only checks of the account named by `ADMIN_EMAIL`, its status, and whether `ADMIN_PASSWORD` matches its bcrypt hash. It prints a result code without printing credentials or changing records. `ACCOUNT_NOT_FOUND` means setup is still needed. `PASSWORD_DOES_NOT_MATCH` means the stored account has a different password; changing `.env` does not reset it. `ACCOUNT_DISABLED` requires authorized account review. The public login response stays generic to avoid exposing account information.

### Local property preview without MongoDB

Set `VITE_DEMO_MODE=true` in `.env.local` and restart `npm run dev` to browse 30 fictional sample properties without MongoDB. This workspace has that local setting enabled. Search, filters, pagination, and detail pages use the samples. Admin operations and inquiries still require the database. Set the flag to `false` and restart to use MongoDB listings. Production builds always use the API.
# AURELIA-ESTATES
