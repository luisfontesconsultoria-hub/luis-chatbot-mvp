# Render — Deploy V1

1. Create a Render Web Service from the GitHub repository.
2. Prefer the committed `render.yaml` configuration.
3. Keep all `sync: false` variables in Render's secret environment only.
4. Build: `npm ci`.
5. Start: `npm start`.
6. Health check: `/health`.
7. Do not put any secret in GitHub, frontend bundles, logs, or screenshots.
8. After deploy, verify `/health` returns HTTP 200 before configuring Meta webhook.
9. Configure the Meta callback URL only after HTTPS is live.
10. For production always-on traffic, plan a paid/always-on service; Free is for V1 validation and low-volume testing.
