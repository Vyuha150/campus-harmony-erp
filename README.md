# Campus Harmony ERP

Campus Harmony ERP is a comprehensive enterprise resource planning (ERP) system designed to streamline and manage various administrative and operational tasks within an educational institution. This project is built using modern web technologies and follows a modular architecture to ensure scalability and maintainability.

## Features

- **Role-Based Access Control (RBAC):**
  - Admin, Faculty, Students, Alumni, and other roles with specific permissions.
- **Grievance Management:**
  - Submit, track, and resolve grievances efficiently.
- **Academic Management:**
  - Manage courses, faculty, and student data.
- **Finance Management:**
  - Handle fees, budgets, and financial reports.
- **Library Management:**
  - Track books, issue/return records, and manage inventory.
- **Placement Assistance:**
  - Manage placement drives and student-company interactions.
- **Sports and Events:**
  - Organize and manage sports activities and events.

## Project Structure

The project is divided into two main parts:

### 1. Frontend
- Built with **React** and **TypeScript**.
- Uses **Vite** for fast development and build processes.
- Tailwind CSS for styling.
- Key directories:
  - `src/components`: Contains reusable UI components.
  - `src/pages`: Contains page-level components.
  - `src/context`: Context providers for global state management.
  - `src/hooks`: Custom React hooks.
  - `src/lib`: Utility functions and API services.

### 2. Backend
- Built with **Node.js** and **TypeScript**.
- Uses **Express.js** for the server.
- **Prisma** ORM for database management.
- Key directories:
  - `backend/src/routes`: Contains route handlers for various modules.
  - `backend/src/middleware`: Middleware for authentication and other tasks.
  - `backend/prisma`: Prisma schema and seed scripts.

## Installation

### Prerequisites
- Node.js (v16 or later)
- npm or yarn
- A MongoDB replica set — a free MongoDB Atlas cluster works (transactions require one)

### Steps

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd campus-harmony-erp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the database (MongoDB):
   - Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI`. It must
     include the database name, e.g.
     `mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/campus_harmony`.
   - In Atlas, add your IP address under **Network Access**.
   - Create the collections and indexes, then load the demo data:
     ```bash
     cd backend
     npm install
     npx prisma db push
     npx prisma db seed
     ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open the application in your browser at `http://localhost:3000`.

## Scripts

- `npm run dev`: Start the development server.
- `npm run build`: Build the project for production.
- `npm run lint`: Lint the codebase.
- `cd backend && npm test`: Run the backend test suite.

## Deployment

Production runs at **https://campus-erp.ivyuha.in** on the company VPS (nginx + PM2),
with the database on MongoDB Atlas. Setup and update steps are in
[`deploy/README.md`](deploy/README.md); after pushing to `main`, run
`bash deploy/deploy.sh` on the VPS.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Commit your changes with clear messages.
4. Submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all contributors and open-source libraries used in this project.

## Database notes (MongoDB)

The backend uses Prisma 6 with the MongoDB connector. A few things behave
differently from a SQL database and are worth knowing before changing data code:

- **No migrations.** `npx prisma db push` syncs collections and indexes from
  `backend/prisma/schema.prisma`.
- **Optional fields are stored as explicit `null`** (`backend/src/lib/explicitNulls.ts`),
  so `where: { field: null }` behaves as it would in SQL. After importing data by
  any route other than the app, run `npm run db:backfill-nulls` in `backend/`.
- **Row locks are write locks.** `lockForUpdate()` in `backend/src/lib/prisma.ts`
  replaces `SELECT … FOR UPDATE`; a concurrent transaction gets a retryable
  `409` instead of waiting.
- **Integrity is enforced by the application only.** MongoDB has no foreign
  keys, CHECK constraints or triggers, so the rules the old SQL schema enforced
  (positive payment amounts, allowed status values, the append-only
  `WorkflowTransition` log) hold only for writes that go through the API.
