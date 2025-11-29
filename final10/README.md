# final10 snapshot from Docker v10.0

This folder is intended to hold a filesystem snapshot extracted from the published Docker images:

- Backend image: `vutheviet/final8new:backend-version10.0`
- Frontend image: `vutheviet/final8new:frontend-version10.0`

What you'll get:
- `backend-image/app/` – runtime Node app (compiled `dist/`), package.json, and creds file if included in the image.
- `frontend-static/html/` – built Angular static site served by Nginx.

Important notes:
- These images are runtime builds. They typically contain compiled JS (`dist`) and static assets, not the original TypeScript/Angular source.
- If the TS sourcemaps in `dist` include inline sources, some source code may be recoverable; otherwise it will just reference original paths.
- Use this snapshot primarily as a behavioral reference (to diff outputs/endpoints), not as a development source tree.

## How to extract

1) Ensure Docker Desktop is running
2) Run the helper script from the repo root:

   PowerShell
   -------------
   .\scripts\extract-docker-v10.ps1

This pulls the images, creates temporary containers, and copies:
- `/app` from backend into `final10/backend-image/app`
- `/usr/share/nginx/html` from frontend into `final10/frontend-static/html`

## Next steps
- If you need to develop with v10 logic, prefer porting the missing behavior into the current code (final8-new) and verify against the extracted runtime.
- If you need exact source parity with v10, the Docker runtime images are insufficient; please provide the original source or a source-inclusive image.
