# Self-hosting

The web repository can run independently with the local demo or your own API.
For production school configuration, database services and deployment workers,
use the [platform self-hosting guide](https://github.com/CBGPU-Engineering/CBGPU-platform/blob/main/docs/SELF_HOSTING.md).
Database schema is owned by [CBGPU-backend](https://github.com/CBGPU-Engineering/CBGPU-backend).

### Careers applications in the admin workspace

`admin.cbgpu.com/admin/careers` reads the careers SQLite database after verifying
the user's Supabase session and `profiles.is_admin` on the server. The frontend
runtime needs Python 3 with sqlite3 and read access to the existing database.
Set `CBGPU_CAREERS_DB_PATH` if its location differs from
`/home/cbgpu/CBGPU-live/backend/private/careers/applications.sqlite`.
The API opens it in read-only mode and does not return form tokens or notification
metadata. Do not copy the database into the repository or public assets.
