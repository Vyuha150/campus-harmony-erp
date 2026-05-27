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
- PostgreSQL (or any other database supported by Prisma)

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

3. Set up the database:
   - Update the `DATABASE_URL` in `.env` file.
   - Run Prisma migrations:
     ```bash
     npx prisma migrate dev
     ```
   - Seed the database:
     ```bash
     npx ts-node backend/prisma/seed.ts
     ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open the application in your browser at `http://localhost:3000`.

## Scripts

- `npm run dev`: Start the development server.
- `npm run build`: Build the project for production.
- `npm run test`: Run tests.
- `npm run lint`: Lint the codebase.

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
