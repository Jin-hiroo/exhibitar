# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately through
GitHub: open the repository's **Security** tab and choose **Report a vulnerability**.

Include what you found, how to reproduce it, and what an attacker could do with it. You should
get a first reply within a week. Fixes land on `main`, which is what the hosted instance runs;
there are no separately supported release branches.

## Security model in short

- **The original STL never leaves the exhibitor's browser.** Parsing, simplification and mat
  generation run client-side. Only the simplified GLB, mat files, marker images, annotation
  images and annotation text are uploaded.
- **The browser only holds the Supabase publishable key.** All authorization happens in
  Postgres row-level security (`supabase/migrations/`): exhibitors can read and write only their
  own projects and the storage folder named after each project.
- **Visitors are anonymous.** They read published projects through the `get_published_project`
  function, which returns only published rows and only the fields the viewer needs.
- **Uploaded assets are public by URL.** The storage buckets are public-read so the viewer can
  load them without signing in. That includes assets of draft projects, whose paths contain a
  random project id. Don't publish anything you need to keep secret.
- **Annotation content is untrusted.** The viewer renders text as text, and only `http(s)`
  links are shown.

## Hardening a self-hosted instance

Most of these are Supabase settings, not code:

- Never put a `service_role` or `sb_secret_…` key in a `NEXT_PUBLIC_*` variable. The app needs
  none.
- Set the server-side minimum password length to at least 8. The sign-up form asks for 8, but
  only the server setting is enforced.
- Turn on [leaked-password protection](https://supabase.com/docs/guides/auth/password-security)
  if your plan includes it.
- Keep the [auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) low. Anyone who
  can sign up can upload files to the public buckets, up to the per-file limits in the
  migrations. The app does not send a CAPTCHA token yet, so turning on Supabase's CAPTCHA
  protection would break sign-in.
- Set the passkey relying-party ID to your production domain only.
