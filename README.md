# ASSIGNBOT.
A black-and-white assignment intake website built for GitHub Pages, with numbered uploads saved to Google Drive and matching rows in Google Sheets. Students can use WhatsApp delivery or leave their name out and use Gmail.

## How it works
The website is entirely static. A hidden Google Apps Script HTML-service bridge receives requests from the approved website origin and calls the receiver using `google.script.run`. Files go to the operator's Drive folder. Contacts, instructions, Drive links, timestamps and matching `AB-000001` references go to a dedicated `ASSIGNBOT Submissions` spreadsheet tab. The operator sends completed files manually.

Each request has a UUID so retries do not create duplicate uploads. A script lock protects sequential numbering. The receiver validates content signatures, file size and contact data; neutralizes spreadsheet formulas; and rolls back the file if the Sheet write fails. It returns only the reference and timestamp, never other submissions or private file links. Public writes are limited to 200 accepted submissions per day. The web app endpoint is public because visitors do not sign in; a browser origin allowlist and per-page nonce secure communication with the iframe, but they are not a substitute for anti-bot protection against determined abuse.

## Google setup
1. Create an Apps Script project with the files in `google-apps-script/`.
2. In Project Settings, add Script Properties `FOLDER_ID` and `SPREADSHEET_ID`. Their values are private and are deliberately absent from this repository.
3. Run `initialize`, review Google's authorization request, and approve the required Drive and Sheets permissions. Google may show an unverified-app warning for your own script.
4. Deploy a web app that executes as you and allows Anyone to access it. No public read endpoint is provided.
5. Copy the `/exec` deployment URL into `public/config.json` as `scriptUrl`, then commit. This URL is public, not a password.
6. Keep `ALLOWED_ORIGINS` in `Code.gs` aligned with your actual Pages origin. Redeploy the Apps Script version after changes.
7. Before collecting personal information, set the upload folder and spreadsheet sharing to Restricted with only the intended operators. Uploaded files inherit folder access.

## Publish on GitHub Pages
The included workflow builds and deploys on every push to `main`. In repository Settings → Pages, choose **GitHub Actions** as the source. The compiled `docs/` directory is also committed, so publishing `main` → `/docs` works without a custom build. Relative asset paths support the `/assignbot/` project URL.

## Development
Node 22.12+ is required.

```sh
npm ci
npm test
npm run dev
npm run build
```

`npm run build` checks TypeScript and writes `docs/`. Do not publish student uploads, contacts, Google credentials, or Script Property values in this repository. No server secrets are required by the static website.

## Limits
One file up to 10 MB: PDF, DOC, DOCX, JPG, JPEG, PNG or TXT. Requirements: up to 5,000 characters. Gmail delivery requires `@gmail.com`. Google's account quotas and available storage also apply. A success reference appears only after Google confirms the matching file and Sheet row.
