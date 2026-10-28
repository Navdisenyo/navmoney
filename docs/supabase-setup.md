# Supabase connection

The intended Supabase project reference is `vxxcheyzliumpmkcrbtu`.

In that project's Supabase dashboard, open the Connect dialog or API settings and obtain the project URL and **publishable** key. Do not use a secret or service-role key for this app's public configuration.

In Netlify, open this project's Environment variables settings and add these variables for production and any previews that should use this database:

| Variable | Setting |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| `VITE_SUPABASE_URL` | Same project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same publishable key |

Make these available to builds and Functions. Redeploy after changing them; browser configuration is embedded during the build. Keep browser and server settings on the same Supabase project.

The Vite configuration also accepts `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as build-time fallbacks when the matching `VITE_` names are absent. Only the two public settings are passed to browser code. A missing URL or publishable key now stops the build instead of publishing a site that fails when authentication starts. An already published browser bundle does not change when environment variables are updated; a fresh deployment is required.

For local development, copy `.env.example` to `.env` and fill it in locally. Environment files are ignored by Git. The obsolete environment file for the previous Supabase project was removed from the repository.

Supabase must already contain the app's tables, owner policies, and signup provisioning trigger. Updating configuration does not migrate accounts or financial records between projects. In Supabase Authentication URL Configuration, allow the deployed app's URL and any intended preview callback URLs for authentication redirects.

The supplied Supabase MCP configuration belongs in Antigravity on your own computer. Restart that client and complete its OAuth flow to authorize its Supabase tools. An MCP server URL does not provide the application with a publishable key or authenticate another coding session.
