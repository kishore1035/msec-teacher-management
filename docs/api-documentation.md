# Teacher Management System — API Documentation

Base URL: `http://localhost:5000/api/v1`

---

## 1. Authentication & Session Management

### 1.1 Login
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Rate Limit:** 5 requests / 15 minutes per IP
- **Request Body:**
```json
{
  "email": "prof.sharma@msec.ac.in",
  "password": "TeacherPassword123"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "67265a782a1708848d799f11",
      "email": "prof.sharma@msec.ac.in",
      "role": "Teacher",
      "isActive": true,
      "lastLogin": "2026-11-02T21:40:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
    }
  },
  "meta": { "timestamp": "2026-11-02T21:40:00.000Z" }
}
```

### 1.2 Rotate Refresh Token
- **Endpoint:** `POST /auth/refresh-token`
- **Access:** Public (Requires valid Refresh Token)
- **Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Access token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
  }
}
```

### 1.3 Logout
- **Endpoint:** `POST /auth/logout`
- **Access:** Bearer JWT Access Token
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully",
  "data": null
}
```

### 1.4 Current User Profile
- **Endpoint:** `GET /auth/me`
- **Access:** Bearer JWT Access Token
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Resource fetched successfully",
  "data": {
    "id": "67265a782a1708848d799f11",
    "email": "prof.sharma@msec.ac.in",
    "role": "Teacher",
    "isActive": true,
    "lastLogin": "2026-11-02T21:40:00.000Z"
  }
}
```

### 1.5 Change Password
- **Endpoint:** `PUT /auth/change-password`
- **Access:** Bearer JWT Access Token
- **Request Body:**
```json
{
  "currentPassword": "TeacherPassword123",
  "newPassword": "NewStrongPassword456"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password changed successfully",
  "data": null
}
```

---

## 2. Academic Year Management

### 2.1 List Academic Years
- **Endpoint:** `GET /academics/years`
- **Access:** Authenticated
- **Query Params:** `?status=Active`
- **Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "67265a882a1708848d799f22",
      "year": "2026-2027",
      "startDate": "2026-08-01T00:00:00.000Z",
      "endDate": "2027-05-31T00:00:00.000Z",
      "semesterType": "ODD",
      "isCurrent": true,
      "status": "Active"
    }
  ]
}
```

### 2.2 Create Academic Year
- **Endpoint:** `POST /academics/years`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "year": "2026-2027",
  "startDate": "2026-08-01",
  "endDate": "2027-05-31",
  "semesterType": "ODD",
  "isCurrent": true
}
```

### 2.3 Set Current Academic Year
- **Endpoint:** `PUT /academics/years/:id/set-current`
- **Access:** Super Admin, Admin

---

## 3. Department Management

### 3.1 List Departments
- **Endpoint:** `GET /departments`
- **Access:** Authenticated

### 3.2 Create Department
- **Endpoint:** `POST /departments`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "name": "Computer Science & Engineering",
  "code": "CSE",
  "description": "Department of CSE"
}
```

---

## 4. Class & Section Management

### 4.1 Create Academic Class
- **Endpoint:** `POST /classes`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "name": "B.E. Computer Science and Engineering",
  "code": "BE-CSE",
  "department": "67265a882a1708848d799f33",
  "degree": "B.E.",
  "durationYears": 4
}
```

### 4.2 Create Section
- **Endpoint:** `POST /sections`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "class": "67265a882a1708848d799f44",
  "academicYear": "67265a882a1708848d799f22",
  "semester": 5,
  "sectionName": "A",
  "classTeacher": "67265a882a1708848d799f55",
  "roomNumber": "L301",
  "capacity": 60
}
```

---

## 5. Subject Management

### 5.1 Create Subject
- **Endpoint:** `POST /subjects`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "name": "Database Management Systems",
  "code": "21CS51",
  "department": "67265a882a1708848d799f33",
  "semester": 5,
  "credits": 4,
  "subjectType": "Theory",
  "modules": [
    {
      "moduleNumber": 1,
      "title": "Introduction to DBMS",
      "topics": ["ER Models", "Relational Algebra", "SQL Queries"]
    }
  ]
}
```

---

## 6. Teacher Assignment Management

### 6.1 Assign Teacher to Subject & Section
- **Endpoint:** `POST /teacher-assignments`
- **Access:** Super Admin, Admin
- **Request Body:**
```json
{
  "teacher": "67265a882a1708848d799f55",
  "subject": "67265a882a1708848d799f66",
  "section": "67265a882a1708848d799f77",
  "academicYear": "67265a882a1708848d799f22",
  "semester": 5,
  "isPrimary": true
}
```

### 6.2 Deactivate/Remove Assignment (Soft-Delete)
- **Endpoint:** `DELETE /teacher-assignments/:id`
- **Access:** Super Admin, Admin

---

## 7. Teacher Personal Endpoints

### 7.1 My Assigned Classes
- **Endpoint:** `GET /teachers/me/classes`
- **Access:** Teacher

### 7.2 My Assigned Subjects
- **Endpoint:** `GET /teachers/me/subjects`
- **Access:** Teacher

### 7.3 My Active Assignments
- **Endpoint:** `GET /teachers/me/assignments`
- **Access:** Teacher
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "67265a882a1708848d799f88",
      "semester": 5,
      "isPrimary": true,
      "status": "Active",
      "subject": {
        "name": "Database Management Systems",
        "code": "21CS51",
        "credits": 4
      },
      "section": {
        "sectionName": "A",
        "semester": 5,
        "roomNumber": "L301"
      },
      "academicYear": {
        "year": "2026-2027",
        "isCurrent": true
      }
    }
  ]
}
```
