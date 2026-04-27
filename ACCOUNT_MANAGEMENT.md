# 👥 User Management Guide

This guide provides step-by-step instructions for creating and managing **Admin**, **Teacher**, and **Student** accounts in the AI MCQ Exam System.

---

## 🏗️ Prerequisites

Before managing users, ensure your environment is set up:

1.  **Clone & Install Dependencies:**
    ```bash
    git clone <your-fork-url>
    cd ai-mcq-exam-system
    cd server && npm install
    cd ../client && npm install
    ```
2.  **Environment Configuration:**
    Create a `.env` file in the `server` directory with:
    - `MONGO_URI`: Your MongoDB connection string.
    - *Optional:* SMTP settings (`MAIL_HOST`, `MAIL_USER`, etc.) for email invites.
3.  **Start Services:**
    - **Server:** `cd server && npm run dev`
    - **Client:** `cd client && npm run dev`

---

## 1️⃣ Creating a User via Admin UI

The most intuitive way to manage users is through the built-in Admin Portal.

### Steps:
1.  **Login:** Sign in as an administrator.
2.  **Navigate:** Go to **Admin → Manage Users** (located in `AdminUsers.jsx`).
3.  **Select Role:** Click **Create Account** and choose **Student**, **Teacher**, or **Admin**.
4.  **Fill Details:**
    | Role | Required Fields | Optional Fields |
    | :--- | :--- | :--- |
    | **Student** | First Name, Last Name, Email | Enrollment No, Class |
    | **Teacher** | First Name, Last Name, Email, Employee ID | Department, Subjects, Assigned Classes |
    | **Admin** | First Name, Last Name, Email, Admin ID | - |
5.  **Password/Invite:**
    - Set a **Temporary Password** manually, OR
    - Check **"Send password setup email"** (requires mail configuration).
6.  **Save:** Click the create button. The server validates and creates the account via `POST /users`.

---

## 2️⃣ Creating a User via API

For automation or technical setup, use the REST API. An **Admin Token** is required.

### Sample Requests:

#### Student
```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Asha",
    "lastName": "Kumar",
    "email": "asha@example.com",
    "role": "student",
    "enrollmentNo": "STU101",
    "password": "TempPass1!"
  }'
```

#### Teacher
```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Rahul",
    "lastName": "Shah",
    "email": "rahul@example.com",
    "role": "teacher",
    "employeeId": "TCH100",
    "subjects": ["CS"],
    "assignedBatches": ["TY-AIA-7"],
    "password": "TempPass1!"
  }'
```

---

## 3️⃣ Bulk Import Users

Import hundreds of users at once using CSV or JSON files.

### UI Workflow:
1.  **Prepare File:** Use the **"Download Sample CSV"** button in the Bulk Import section to get the correct layout.
2.  **Upload:** Select the role, set a **Shared Temporary Password**, and pick your file.
3.  **Validate:** Click **Validate** to check for errors (Max 500 rows).
4.  **Import:** Click **Start Import**. The server processes `POST /users/bulk` and returns a summary of successes and failures.

---

## 4️⃣ Utility Script: Demo Student

Quickly create a demo student for testing without using the UI or API.

### Run Script:
```bash
cd server
node scripts/createDemoStudent.js
```
This script creates a student with:
- **Email:** `demo@student.com`
- **Password:** `Demo123!`
- **Enrollment:** `DEMO001`

---

## 5️⃣ Admin Operations

Once a user is created, you can perform these actions from the **Manage Users** screen:

- **Reset Password:** Send a setup link via `POST /users/:id/send-password-link`.
- **Edit Details:** Update names, IDs, or assignments via `PUT /users/:id`.
- **Change Role:** Promote or demote users via `PUT /users/:id/role`.
- **Toggle Status:** Activate or deactivate accounts via `PUT /users/:id/status`.

---

## ✅ Quick Validation Checklist

- [ ] **Database:** Is `MONGO_URI` correct and reachable?
- [ ] **First Admin:** Have you seeded the initial admin? (`npm run seed:admin` in server).
- [ ] **Emails:** If using "Send Invite", are your SMTP environment variables set?

---

> [!TIP]
> All backend logic resides in `user.controller.js` and routes are defined in `user.route.js`. For frontend interactions, refer to `userService.js`.
