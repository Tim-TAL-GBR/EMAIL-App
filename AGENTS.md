# TeamMail – Development Guide

## Project Structure
- `server/` – Express + TypeScript backend (port 3001)
- `apps/mobile/` – Expo (React Native) mobile app (iOS + macOS)
- `packages/shared/` – Shared TypeScript types and Zod schemas
- `supabase/` – Database migrations, RLS, seed data

## Commands

### Development
```bash
pnpm dev:server   # Start backend (tsx watch)
pnpm dev:app      # Start Expo (iOS/Mac)
pnpm build        # Build all packages
pnpm lint         # Type-check all packages
```

### Database
```bash
pnpm db:reset     # Reset Supabase local DB
pnpm db:migrate   # Run migrations
pnpm db:types     # Regenerate TypeScript types from DB
```

### Server runs on: http://localhost:3001
### Supabase Studio: http://localhost:54323

## API Endpoints

### Inboxes
- `GET    /api/inboxes` – List user's inboxes
- `GET    /api/inboxes/:id` – Inbox detail with members
- `GET    /api/inboxes/:id/emails` – Emails in inbox (filter: ?status=, limit=, offset=)

### Emails
- `GET    /api/emails/:id` – Email detail
- `PATCH  /api/emails/:id/status` – Update status
- `POST   /api/emails/:id/assign` – Assign to user
- `POST   /api/emails/:id/toggle-star` – Toggle star
- `POST   /api/emails/:id/read` – Mark as read

### Mail
- `POST   /api/mail/send` – Send email via SMTP

### Comments
- `GET    /api/comments?email_id=` – List comments
- `POST   /api/comments` – Create comment

### Templates
- `GET    /api/templates` – List templates
- `POST   /api/templates` – Create template
- `PUT    /api/templates/:id` – Update template
- `DELETE /api/templates/:id` – Delete template

### Push
- `POST   /api/push/register` – Register push token
- `DELETE /api/push/unregister` – Unregister push token

## TypeScript Checks
```bash
cd server && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit
cd packages/shared && npx tsc --noEmit
```

## Mac App Setup
1. Ensure Xcode 16+ is installed
2. `cd apps/mobile && npx expo run:macos`
3. Update `app.json` `extra.eas.projectId` with your EAS project ID

## iOS App Setup
1. `cd apps/mobile && npx expo run:ios`
2. For push notifications: configure EAS credentials
