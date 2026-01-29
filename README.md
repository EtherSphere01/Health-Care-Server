## HealthCare Management System - Backend API

Short description: A scalable TypeScript + Express + Prisma REST API for healthcare management (users, scheduling, appointments, payments, prescriptions, and reviews).

![Node.js](https://img.shields.io/badge/Node.js-v18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![Prisma](https://img.shields.io/badge/Prisma-ORM-teal)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue)

A robust and scalable REST API for a complete HealthCare Management System. This backend manages Users (Admins, Doctors, Patients), Appointments, Prescriptions, Real-time Scheduling, Payments via Stripe, and AI-powered doctor recommendations.

## 🚀 Key Features

- **Role-Based Access Control (RBAC):** Secure authentication for `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, and `PATIENT`.
- **Advanced Scheduling:** Dynamic time-slot management for doctors and appointment booking.
- **AI Integration:** Smart doctor/specialty suggestions based on symptoms (using OpenRouter/LLMs).
- **Payment Gateway:** Seamless integration with Stripe for appointment payments and webhook handling.
- **Media Management:** Cloudinary integration for profile pictures and specialty icons.
- **Notification System:** Email notifications for password resets via Nodemailer.
- **Data Validation:** Strict schema validation using Zod.

---

## 🛠 Technology Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT (JSON Web Tokens)
- **Payments:** Stripe
- **File Storage:** Cloudinary
- **AI/LLM:** OpenRouter API
- **Package Manager:** pnpm

---

## ⚙️ Prerequisites

Before getting started, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/installation) / npm / yarn
- [PostgreSQL](https://www.postgresql.org/) (Local or Cloud)

---

## 📦 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/EtherSphere01/Health-Care-Server.git
cd Health-Care-Server
```

### 2. Install Dependencies

pnpm:

```bash
pnpm install
```

npm:

```bash
npm install
```

yarn:

```bash
yarn
```

### 3. Environment Configuration

Create a `.env` file in the root directory and configure the following variables:

```env
NODE_ENV=development
PORT=5000

# Database Connection
DATABASE_URL="postgresql://username:password@localhost:5432/health_care_db?schema=public"

# Authentication (JWT)
SALT_ROUND=10
JWT_SECRET=your_super_secret_jwt_key
EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key
REFRESH_TOKEN_EXPIRES_IN=30d

# Email Configuration (Nodemailer/Gmail)
EMAIL=your_email@gmail.com
APP_PASS=your_app_password
RESET_PASS_LINK=http://localhost:3000/reset-password
RESET_PASS_TOKEN=temp_token_string
RESET_PASS_TOKEN_EXPIRES_IN=5m

# Cloudinary (File Uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Stripe (Payments)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI Integration (OpenRouter)
OPENROUTER_API_KEY=sk-or-v1-...
```

### 4. Database Setup

Generate the Prisma client and push the schema to your database.

pnpm:

```bash
# Generate Prisma Client
pnpm prisma:generate

# Run migrations (development)
pnpm exec prisma migrate dev
```

npm:

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations (development)
npx prisma migrate dev
```

yarn:

```bash
# Generate Prisma Client
yarn prisma:generate

# Run migrations (development)
yarn prisma migrate dev
```

Notes (kept from the original intent):

- Push Schema to DB (No migration history)
- OR run migrations (if using migration history)

### 5. Run the Server

**Development Mode (Hot Reload):**

pnpm:

```bash
pnpm dev
```

npm:

```bash
npm run dev
```

yarn:

```bash
yarn dev
```

**Production Build:**

pnpm:

```bash
pnpm build
pnpm start
```

npm:

```bash
npm run build
npm run start
```

yarn:

```bash
yarn build
yarn start
```

---

## 📡 API Documentation

Base URL: http://localhost:5000/api/v1

### 1. 🔐 Authentication (/auth)

| Method | Endpoint              | Description                                   |
| :----- | :-------------------- | :-------------------------------------------- |
| POST   | /auth/login           | Login user (Returns Access & Refresh Tokens)  |
| POST   | /auth/refresh-token   | Generate new Access Token using Refresh Token |
| POST   | /auth/change-password | Change password (Authenticated users)         |
| POST   | /auth/forgot-password | Request password reset link via email         |
| POST   | /auth/reset-password  | Reset password using email token              |
| GET    | /auth/me              | Check authentication status                   |

### 2. 👤 User Management (/user)

| Method | Endpoint                | Description                                            |
| :----- | :---------------------- | :----------------------------------------------------- |
| GET    | /user                   | Get all users (Admin only, Supports Pagination/Search) |
| GET    | /user/me                | Get current logged-in user's profile                   |
| POST   | /user/create-admin      | Create new Admin (Multipart/Form-data)                 |
| POST   | /user/create-doctor     | Create new Doctor (Multipart/Form-data)                |
| POST   | /user/create-patient    | Create new Patient (Multipart/Form-data, Public)       |
| PATCH  | /user/:id/status        | Update User Status (ACTIVE, BLOCKED)                   |
| PATCH  | /user/update-my-profile | Update own profile (Multipart/Form-data)               |

### 3. 🛡️ Admin (/admin)

| Method | Endpoint        | Description            |
| :----- | :-------------- | :--------------------- |
| GET    | /admin          | Get all Admins         |
| GET    | /admin/:id      | Get Admin by ID        |
| PATCH  | /admin/:id      | Update Admin details   |
| DELETE | /admin/:id      | Permanent Delete Admin |
| DELETE | /admin/soft/:id | Soft Delete Admin      |

### 4. 👨‍⚕️ Doctor (/doctor)

| Method | Endpoint           | Description                                              |
| :----- | :----------------- | :------------------------------------------------------- |
| GET    | /doctor            | Get all Doctors (Filters: searchTerm, specialties)       |
| GET    | /doctor/:id        | Get Doctor by ID                                         |
| GET    | /doctor/suggestion | **AI Feature:** Get doctor suggestions based on symptoms |
| PATCH  | /doctor/:id        | Update Doctor details & Specialties                      |
| DELETE | /doctor/:id        | Permanent Delete Doctor                                  |
| DELETE | /doctor/soft/:id   | Soft Delete Doctor                                       |

### 5. 🏥 Patient (/patient)

| Method | Endpoint          | Description              |
| :----- | :---------------- | :----------------------- |
| GET    | /patient          | Get all Patients         |
| GET    | /patient/:id      | Get Patient by ID        |
| PATCH  | /patient/:id      | Update Patient details   |
| DELETE | /patient/:id      | Permanent Delete Patient |
| DELETE | /patient/soft/:id | Soft Delete Patient      |

### 6. 🩺 Specialties (/specialties)

| Method | Endpoint         | Description                             |
| :----- | :--------------- | :-------------------------------------- |
| GET    | /specialties     | Get all medical specialties             |
| POST   | /specialties     | Create Specialty (Requires Icon Upload) |
| DELETE | /specialties/:id | Delete Specialty                        |

### 7. 📅 Schedule (/schedule)

_Admin manages master time slots._

| Method | Endpoint      | Description                        |
| :----- | :------------ | :--------------------------------- |
| GET    | /schedule     | Get all available schedule slots   |
| GET    | /schedule/:id | Get schedule by ID                 |
| POST   | /schedule     | Create new time slots (Admin only) |
| DELETE | /schedule/:id | Delete a schedule slot             |

### 8. 🗓️ Doctor Schedule (/doctor-schedule)

_Doctors assign master slots to their own calendar._

| Method | Endpoint                     | Description                                 |
| :----- | :--------------------------- | :------------------------------------------ |
| GET    | /doctor-schedule             | Get all doctor schedules (Filter: isBooked) |
| GET    | /doctor-schedule/my-schedule | Get logged-in Doctor's schedule             |
| POST   | /doctor-schedule             | Doctor assigns slots to themselves          |
| DELETE | /doctor-schedule/:id         | Remove slot from Doctor's schedule          |

### 9. 📝 Appointments (/appointment)

| Method | Endpoint                    | Description                                                |
| :----- | :-------------------------- | :--------------------------------------------------------- |
| GET    | /appointment                | Get all appointments (Admin)                               |
| GET    | /appointment/my-appointment | Get appointments for logged-in Patient/Doctor              |
| POST   | /appointment                | Book an appointment (Patient)                              |
| PATCH  | /appointment/status/:id     | Change status (SCHEDULED, INPROGRESS, COMPLETED, CANCELED) |

### 10. 💳 Payments (/payment)

| Method | Endpoint                             | Description                       |
| :----- | :----------------------------------- | :-------------------------------- |
| POST   | /payment/init-payment/:appointmentId | Initialize Stripe Payment Session |
| GET    | /payment/ipn                         | Validate Payment (Callback/IPN)   |

### 11. 💊 Prescriptions (/prescription)

| Method | Endpoint                      | Description                        |
| :----- | :---------------------------- | :--------------------------------- |
| GET    | /prescription                 | Get all prescriptions (Admin)      |
| GET    | /prescription/my-prescription | Get logged-in user's prescriptions |
| POST   | /prescription                 | Create Prescription (Doctor only)  |

### 12. ⭐ Reviews (/review)

| Method | Endpoint | Description                    |
| :----- | :------- | :----------------------------- |
| GET    | /review  | Get reviews (Filter by Doctor) |
| POST   | /review  | Create a review (Patient only) |

### 13. 📊 Meta (/meta)

| Method | Endpoint | Description                                           |
| :----- | :------- | :---------------------------------------------------- |
| GET    | /meta    | Get Dashboard Statistics (User counts, Revenue, etc.) |

---

## 🗄️ Database Schema (ERD)

_(Ensure ERD.jpg is present in your project root)_

---

## 📜 Scripts

| Script              | Description                                |
| :------------------ | :----------------------------------------- |
| pnpm dev            | Start development server with ts-node-dev  |
| pnpm build          | Compile TypeScript to JavaScript           |
| pnpm start          | Start the production server                |
| pnpm db:generate    | Generate Prisma Client                     |
| pnpm db:push        | Push schema changes to DB (Prototyping)    |
| pnpm db:migrate     | Run production migrations                  |
| pnpm db:studio      | Open Prisma Studio GUI                     |
| pnpm stripe:webhook | Forward Stripe webhook events to localhost |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (git checkout \-b feature/AmazingFeature)
3. Commit your changes (git commit \-m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a Pull Request
