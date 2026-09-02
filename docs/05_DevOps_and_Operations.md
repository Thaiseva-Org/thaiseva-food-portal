# Part 5: DevOps and Operations

## 1. CI/CD & Deployment Strategy
Deployment to production is gated behind strict verification hooks configured in `firebase.json` and `package.json`. 

**Command:** `firebase deploy --only hosting`

**The Predeploy Hook (`production:check`):**
1. **Linting:** Scans the entire React codebase using ESLint with a `--max-warnings 0` flag. Any syntax or unused variable warning instantly halts the deployment.
2. **Testing:** Executes native Node tests (`node --test`) covering security boundaries, application flows, and backend logic.
3. **Security Auditing:** Runs `npm audit --omit=dev` for both the frontend and the `functions/` directory to prevent deploying known CVEs in production dependencies.
4. **Build:** Vite compiles the optimized production payload into the `/dist` directory.

## 2. Infrastructure as Code (Security Rules)
Firebase configuration acts as our infrastructure definition.

- **`firestore.rules`:** Maps exact custom claims to document access rights. No logic exists purely in the frontend.
- **`storage.rules`:** Enforces size limits (e.g., maximum 15MB for file uploads) and strictly prevents listing contents of the bucket.

## 3. Operational Runbook

### Scenario A: Deployment fails with "ENOENT spawn npm run production:check"
- **Cause:** Corrupted local `node_modules` or missing scripts in `functions/package.json`.
- **Resolution:** Run `npm ci` in the root and in the `/functions` directory to ensure exact dependency trees are installed.

### Scenario B: Cloud Function returns `500 Internal Server Error` on Signed URLs
- **Cause:** The default Google Cloud App Engine service account lacks the `Service Account Token Creator` role required to generate Signed URLs.
- **Resolution:** This project intentionally sidesteps this by using the Firebase Client SDK (`getDownloadURL`) instead of backend signed URLs for file access.

### Scenario C: Users report a blank white screen
- **Detection Method:** User reports.
- **Resolution:** Check the browser console. The new Global Error Boundary should catch this, meaning a developer left an unhandled syntax error. Look for `import.meta.env.DEV` stack traces locally to debug.

## 4. Local Development
- **Running the App:** `npm run dev` starts the Vite server on port `5000`.
- **Seeding Dummy Data:** Use `npm run seed:riders` or `npm run seed:restaurant` to inject fake data directly into your staging/dev Firestore instance for testing.
- **Environment:** Firebase App Check operates in debug mode locally. Do NOT deploy localhost debug tokens to production.

## 5. Known Limitations & Future Improvements
- **Firestore Scalability:** Currently, the Master Admin network monitor pulls the entire `/restaurants` list. In the future, this should implement a paginated cursor or sync to BigQuery to prevent massive read costs as the network grows to 1,000+ restaurants.
- **Real-time Subscriptions:** Listening to `/orders` for the whole network is fine for MVP, but should be partitioned by geographical zone in V2 to optimize websocket traffic.
