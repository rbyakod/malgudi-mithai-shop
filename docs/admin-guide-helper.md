# Admin guide helper (explain-only)

A floating "Ask the admin guide" panel on every `/admin` page. It explains what a setting does and what changes if it is altered. It **cannot change anything** and cannot see orders, customers or other data.

## How it fits together
- The panel script is served by the agent service (`/agent-team/js/admin-guide.js`) and is loaded by `components/payload-admin/guide/AdminGuideLoader.tsx` (registered in `payload.config.ts` under `afterNavLinks`).
- The panel posts to this site's own `POST /api/admin-guide` (`app/api/admin-guide/route.ts`). That route checks the person is a signed-in Payload admin **and** has an allowed role, then forwards the question to the agent service with a shared token (`lib/admin-guide.ts`). The token never reaches the browser.
- The agent service answers from its admin guide (`data/advisor/admin-guide.md` in the `mishran-agents` repository), which is where the text about each setting lives. **When an admin setting changes or a new one is added, update that file.**

## Settings (server env)
| Variable | Meaning |
|---|---|
| `AGENT_SERVICE_URL` | The agent service's admin API, e.g. `http://127.0.0.1:3082/api/team-admin` |
| `AGENT_GUIDE_TOKEN` | Shared secret, at least 32 characters, same value on the agent service |
| `ADMIN_GUIDE_ROLES` | Roles that may ask. Default `admin` (the owner). Add `editor,ops` to let shop staff use it |

Unset the token or the address and the route answers 503 ("not set up"); nothing else in the admin is affected.

## Where things are decided
- Who may ask: `ADMIN_GUIDE_ROLES` (this site).
- What it answers from, its model, and its daily limit: the agent service (`adminGuide.*` settings, Models & limits in `/team-admin`).
