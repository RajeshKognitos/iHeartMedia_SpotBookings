# Deploying to Vercel

## 1. Push your code to Git

Ensure your project is in a Git repo and push to GitHub, GitLab, or Bitbucket:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

## 2. Import the project in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub/GitLab/Bitbucket).
2. Click **Add New…** → **Project**.
3. Import your repository (e.g. `iHeartMedia_SpotBookings`).
4. **Framework Preset:** Vercel should detect Next.js. Leave **Build Command** as `npm run build` and **Output Directory** as default.
5. Do **not** deploy yet — add environment variables first.

## 3. Set environment variables

In the Vercel project, go to **Settings** → **Environment Variables** and add these (for **Production**, and optionally **Preview**):

| Variable | Required | Notes |
|----------|----------|--------|
| `KOGNITOS_TOKEN` | Yes | PAT token (`kgn_pat_...`) |
| `KOGNITOS_ORG_ID` | Yes | From Kognitos URL or dashboard |
| `KOGNITOS_WORKSPACE_ID` | Yes | From Kognitos URL or dashboard |
| `KOGNITOS_BASE_URL` | Yes | e.g. `https://app.us-1.kognitos.com/api/v1` |
| `KOGNITOS_AUTOMATION_ID` | Yes | Automation (process) ID |
| `NEXT_PUBLIC_KOGNITOS_URL` | Yes | Base app URL for links, e.g. `https://app.us-1.kognitos.com/organizations/{ORG_ID}/workspaces/{WS_ID}` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (for Chat) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (for Chat) | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (for Chat) | Supabase service role key |
| `ANTHROPIC_API_KEY` | Yes (for Chat) | Claude API key |
| `KOGNITOS_REST_API_URL` | Optional | For file upload, e.g. `https://rest-api.app.kognitos.com` |
| `KOGNITOS_API_KEY` | Optional | REST API key for file upload |

Use the same values as in your local `.env`. Never commit `.env` to the repo.

## 4. Dependencies (Lattice UI)

If you use Lattice UI from a local tarball (`"@kognitos/lattice": "file:kognitos-lattice-*.tgz"`):

- **Option A:** Commit the `.tgz` file to the repo so `npm install` on Vercel can use it.
- **Option B:** Publish Lattice to a private npm registry and reference it by version in `package.json`; then set `NPM_TOKEN` (or similar) in Vercel for that registry.

If the tarball is not in the repo and no registry is set up, the Vercel build will fail at `npm install`.

## 5. Deploy

1. After saving environment variables, go to **Deployments** and trigger a new deployment (or push a new commit).
2. Vercel runs `npm install` and `npm run build`. The first deployment may take a few minutes.
3. When the build succeeds, you get a URL like `https://your-project.vercel.app`.

## 6. After deployment

- **Production URL:** Use the generated `*.vercel.app` URL or add a custom domain under **Settings** → **Domains**.
- **Preview deployments:** Each push to a branch gets a preview URL; use the same env vars for Preview if you want Chat and Kognitos to work there.
- **Logs:** Use **Deployments** → select a deployment → **Building** / **Functions** for logs and errors.

## Troubleshooting

- **Build fails on `apache-arrow`:** The app already marks it in `next.config.ts` as `serverExternalPackages`; if you see module errors, ensure Node version is 18+ (Vercel default).
- **503 / "not configured":** Check that all required env vars are set and that `KOGNITOS_BASE_URL` ends with `/api/v1`.
- **File upload 503:** Add `KOGNITOS_REST_API_URL` and `KOGNITOS_API_KEY` if you use the Run job file upload feature.
