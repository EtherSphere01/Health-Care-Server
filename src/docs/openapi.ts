type SchemaObject = Record<string, any>;
type ParameterObject = Record<string, any>;

const AUTH_HEADER_DESCRIPTION =
    "Access token. The API expects the raw JWT in the `Authorization` header (not `Bearer <token>`).";

function jsonContent(schema: SchemaObject) {
    return {
        schema,
    };
}

const ApiResponseSchema: SchemaObject = {
    type: "object",
    properties: {
        success: { type: "boolean" },
        statusCode: { type: "integer" },
        message: { type: "string" },
        data: {},
        meta: {
            type: "object",
            properties: {
                page: { type: "integer" },
                limit: { type: "integer" },
                total: { type: "integer" },
            },
            additionalProperties: true,
        },
    },
    additionalProperties: true,
};

const ErrorResponseSchema: SchemaObject = {
    type: "object",
    properties: {
        success: { type: "boolean", enum: [false] },
        statusCode: { type: "integer" },
        message: { type: "string" },
        errorMessages: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    path: { type: "string" },
                    message: { type: "string" },
                },
            },
        },
    },
    additionalProperties: true,
};

const PaginationQueryParams: ParameterObject[] = [
    {
        name: "page",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1 },
        description: "Page number (1-indexed).",
    },
    {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1 },
        description: "Items per page.",
    },
    {
        name: "sortBy",
        in: "query",
        required: false,
        schema: { type: "string" },
        description: "Sort field.",
    },
    {
        name: "sortOrder",
        in: "query",
        required: false,
        schema: { type: "string", enum: ["asc", "desc"] },
        description: "Sort order.",
    },
];

export function createOpenApiSpec(): any {
    const vercelUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined;

    const rawServerUrl = process.env.SWAGGER_SERVER_URL || vercelUrl || "/";
    const serverUrl =
        rawServerUrl !== "/" && !/^https?:\/\//i.test(rawServerUrl)
            ? `https://${rawServerUrl}`
            : rawServerUrl;

    const spec: any = {
        openapi: "3.0.3",
        info: {
            title: "Nexus HealthCare Management API",
            version: "1.0.0",
            description:
                "REST API for healthcare management (users, admins, doctors, patients, scheduling, appointments, payments, prescriptions, reviews, meta dashboard, notifications).",
        },
        servers: [
            {
                url: serverUrl,
                description:
                    "API server base URL. Set SWAGGER_SERVER_URL in production for correct Try-it-out URLs.",
            },
        ],
        tags: [
            { name: "Health" },
            { name: "Auth" },
            { name: "User" },
            { name: "Admin" },
            { name: "Doctor" },
            { name: "Patient" },
            { name: "Specialties" },
            { name: "Schedule" },
            { name: "DoctorSchedule" },
            { name: "Appointment" },
            { name: "Payment" },
            { name: "Prescription" },
            { name: "Review" },
            { name: "Meta" },
            { name: "Notification" },
            { name: "Stripe" },
        ],
        components: {
            securitySchemes: {
                accessToken: {
                    type: "apiKey",
                    in: "header",
                    name: "Authorization",
                    description: AUTH_HEADER_DESCRIPTION,
                },
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "accessToken",
                    description:
                        "Cookie-based auth supported for browser flows. Many clients use Authorization header instead.",
                },
            },
            schemas: {
                ApiResponse: ApiResponseSchema,
                ErrorResponse: ErrorResponseSchema,
            },
        },
        paths: {
            "/": {
                get: {
                    tags: ["Health"],
                    summary: "Health check",
                    description: "Returns a basic server message.",
                    responses: {
                        "200": {
                            description: "OK",
                            content: {
                                "application/json": jsonContent({
                                    type: "object",
                                    additionalProperties: true,
                                }),
                            },
                        },
                    },
                },
            },

            // -----------------
            // AUTH
            // -----------------
            "/api/v1/auth/login": {
                post: {
                    tags: ["Auth"],
                    summary: "Login",
                    description:
                        "Login with email/password. Returns access/refresh tokens (and also sets cookies depending on client).",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                required: ["email", "password"],
                                properties: {
                                    email: { type: "string", format: "email" },
                                    password: { type: "string" },
                                },
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Login successful",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                        "400": {
                            description: "Invalid credentials",
                            content: {
                                "application/json":
                                    jsonContent(ErrorResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/auth/refresh-token": {
                post: {
                    tags: ["Auth"],
                    summary: "Refresh token",
                    description:
                        "Generates a new access token using the refresh token cookie.",
                    responses: {
                        "200": {
                            description: "Refreshed",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                        "401": {
                            description: "Not authorized",
                            content: {
                                "application/json":
                                    jsonContent(ErrorResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/auth/me": {
                get: {
                    tags: ["Auth"],
                    summary: "Get current user",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    responses: {
                        "200": {
                            description: "Current user",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                        "401": {
                            description: "Not authorized",
                            content: {
                                "application/json":
                                    jsonContent(ErrorResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/auth/change-password": {
                post: {
                    tags: ["Auth"],
                    summary: "Change password",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                required: ["oldPassword", "newPassword"],
                                properties: {
                                    oldPassword: { type: "string" },
                                    newPassword: { type: "string" },
                                },
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Password changed",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                        "401": {
                            description: "Not authorized",
                            content: {
                                "application/json":
                                    jsonContent(ErrorResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/auth/forgot-password": {
                post: {
                    tags: ["Auth"],
                    summary: "Forgot password",
                    description: "Sends a password reset email if configured.",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                required: ["email"],
                                properties: {
                                    email: { type: "string", format: "email" },
                                },
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Email queued/sent",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/auth/reset-password": {
                post: {
                    tags: ["Auth"],
                    summary: "Reset password",
                    description:
                        "Resets password using reset token (Authorization header in email flow) or cookie-based auth for logged-in users.",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                required: ["password"],
                                properties: {
                                    password: { type: "string" },
                                },
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Password reset",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/auth/register-patient/request-otp": {
                post: {
                    tags: ["Auth"],
                    summary: "Request patient registration OTP",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                required: ["name", "email", "password"],
                                properties: {
                                    name: { type: "string" },
                                    email: { type: "string", format: "email" },
                                    password: { type: "string" },
                                },
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "OTP sent",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/auth/register-patient/verify-otp": {
                post: {
                    tags: ["Auth"],
                    summary: "Verify patient registration OTP",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                required: ["email", "otp"],
                                properties: {
                                    email: { type: "string", format: "email" },
                                    otp: { type: "string" },
                                },
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "OTP verified",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // USER
            // -----------------
            "/api/v1/user": {
                get: {
                    tags: ["User"],
                    summary: "Get all users",
                    description: "Admin/Super Admin only.",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Users list",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/user/me": {
                get: {
                    tags: ["User"],
                    summary: "Get my profile",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    responses: {
                        "200": {
                            description: "My profile",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/user/create-admin": {
                post: {
                    tags: ["User"],
                    summary: "Create admin",
                    description:
                        "Admin/Super Admin only. Multipart form-data with `data` JSON and optional `file`.",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    type: "object",
                                    required: ["data"],
                                    properties: {
                                        data: {
                                            type: "string",
                                            description:
                                                "JSON string for admin creation payload.",
                                        },
                                        file: {
                                            type: "string",
                                            format: "binary",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Admin created",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/user/create-doctor": {
                post: {
                    tags: ["User"],
                    summary: "Create doctor",
                    description:
                        "Admin/Super Admin only. Multipart form-data with `data` JSON and optional `file`.",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    type: "object",
                                    required: ["data"],
                                    properties: {
                                        data: { type: "string" },
                                        file: {
                                            type: "string",
                                            format: "binary",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Doctor created",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/user/create-patient": {
                post: {
                    tags: ["User"],
                    summary: "Create patient",
                    description:
                        "Admin/Super Admin only in current implementation. Multipart form-data with `data` JSON and optional `file`.",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    type: "object",
                                    required: ["data"],
                                    properties: {
                                        data: { type: "string" },
                                        file: {
                                            type: "string",
                                            format: "binary",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Patient created",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/user/{id}/status": {
                patch: {
                    tags: ["User"],
                    summary: "Update user status",
                    description: "Admin/Super Admin only.",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                required: ["status"],
                                properties: {
                                    status: {
                                        type: "string",
                                        description: "User status enum.",
                                    },
                                },
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Status updated",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/user/update-my-profile": {
                patch: {
                    tags: ["User"],
                    summary: "Update my profile",
                    description:
                        "Authenticated users. Multipart form-data with `data` JSON and optional `file`.",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    type: "object",
                                    required: ["data"],
                                    properties: {
                                        data: { type: "string" },
                                        file: {
                                            type: "string",
                                            format: "binary",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Updated",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // ADMIN
            // -----------------
            "/api/v1/admin": {
                get: {
                    tags: ["Admin"],
                    summary: "Get all admins",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Admins list",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/admin/{id}": {
                get: {
                    tags: ["Admin"],
                    summary: "Get admin by id",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Admin",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                patch: {
                    tags: ["Admin"],
                    summary: "Update admin",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Updated",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                delete: {
                    tags: ["Admin"],
                    summary: "Delete admin",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Deleted",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/admin/soft/{id}": {
                delete: {
                    tags: ["Admin"],
                    summary: "Soft delete admin",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Soft deleted",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // SPECIALTIES
            // -----------------
            "/api/v1/specialties": {
                get: {
                    tags: ["Specialties"],
                    summary: "Get specialties",
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Specialties list",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                post: {
                    tags: ["Specialties"],
                    summary: "Create specialty",
                    description:
                        "Multipart form-data with `data` JSON and required `file` for icon depending on your validation.",
                    requestBody: {
                        required: true,
                        content: {
                            "multipart/form-data": {
                                schema: {
                                    type: "object",
                                    required: ["data"],
                                    properties: {
                                        data: { type: "string" },
                                        file: {
                                            type: "string",
                                            format: "binary",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "Created",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/specialties/{id}": {
                delete: {
                    tags: ["Specialties"],
                    summary: "Delete specialty",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Deleted",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // DOCTOR
            // -----------------
            "/api/v1/doctor": {
                get: {
                    tags: ["Doctor"],
                    summary: "Get doctors",
                    description:
                        "Public. Supports filtering by searchTerm and specialties (title).",
                    parameters: [
                        ...PaginationQueryParams,
                        {
                            name: "searchTerm",
                            in: "query",
                            required: false,
                            schema: { type: "string" },
                        },
                        {
                            name: "specialties",
                            in: "query",
                            required: false,
                            schema: { type: "string" },
                            description:
                                "Specialty title (can be repeated as multiple query params).",
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Doctors list",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/doctor/{id}": {
                get: {
                    tags: ["Doctor"],
                    summary: "Get doctor by id",
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Doctor",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                        "404": {
                            description: "Not found",
                            content: {
                                "application/json":
                                    jsonContent(ErrorResponseSchema),
                            },
                        },
                    },
                },
                patch: {
                    tags: ["Doctor"],
                    summary: "Update doctor",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Updated",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                delete: {
                    tags: ["Doctor"],
                    summary: "Delete doctor",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Deleted",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/doctor/soft/{id}": {
                delete: {
                    tags: ["Doctor"],
                    summary: "Soft delete doctor",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Soft deleted",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/doctor/suggestion": {
                post: {
                    tags: ["Doctor"],
                    summary: "AI doctor suggestion",
                    description:
                        "Public. Suggests doctors/specialties based on symptoms using OpenRouter.",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                required: ["symptoms"],
                                properties: {
                                    symptoms: { type: "string" },
                                },
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Suggestion",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/doctor/ai-suggestion": {
                post: {
                    tags: ["Doctor"],
                    summary: "Consultation AI triage suggestion",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                required: ["symptoms"],
                                properties: {
                                    symptoms: { type: "string" },
                                },
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Suggestion",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // PATIENT
            // -----------------
            "/api/v1/patient": {
                get: {
                    tags: ["Patient"],
                    summary: "Get patients",
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Patients list",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/patient/{id}": {
                get: {
                    tags: ["Patient"],
                    summary: "Get patient by id",
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Patient",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                patch: {
                    tags: ["Patient"],
                    summary: "Update patient",
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Updated",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                delete: {
                    tags: ["Patient"],
                    summary: "Delete patient",
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Deleted",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/patient/soft/{id}": {
                delete: {
                    tags: ["Patient"],
                    summary: "Soft delete patient",
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Soft deleted",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // SCHEDULE
            // -----------------
            "/api/v1/schedule": {
                get: {
                    tags: ["Schedule"],
                    summary: "Get schedules",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Schedules list",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                post: {
                    tags: ["Schedule"],
                    summary: "Create schedules",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Created",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/schedule/{id}": {
                get: {
                    tags: ["Schedule"],
                    summary: "Get schedule by id",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Schedule",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                delete: {
                    tags: ["Schedule"],
                    summary: "Delete schedule",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Deleted",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                        "409": {
                            description:
                                "Conflict (e.g., schedule is already assigned)",
                            content: {
                                "application/json":
                                    jsonContent(ErrorResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // DOCTOR SCHEDULE
            // -----------------
            "/api/v1/doctor-schedule/public": {
                get: {
                    tags: ["DoctorSchedule"],
                    summary: "Public doctor schedules",
                    description:
                        "Public listing of doctor schedules (used by public consultation flows).",
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Doctor schedules",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/doctor-schedule": {
                get: {
                    tags: ["DoctorSchedule"],
                    summary: "Get doctor schedules",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Doctor schedules",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                post: {
                    tags: ["DoctorSchedule"],
                    summary: "Assign schedule to doctor",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Assigned",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/doctor-schedule/my-schedule": {
                get: {
                    tags: ["DoctorSchedule"],
                    summary: "Get my doctor schedule",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "My schedule",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/doctor-schedule/{id}": {
                delete: {
                    tags: ["DoctorSchedule"],
                    summary: "Remove doctor schedule entry",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Removed",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // APPOINTMENT
            // -----------------
            "/api/v1/appointment": {
                get: {
                    tags: ["Appointment"],
                    summary: "Get all appointments",
                    description: "Admin/Super Admin only.",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Appointments",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                post: {
                    tags: ["Appointment"],
                    summary: "Book appointment (pay now)",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                                description:
                                    "Uses AppointmentValidation.createAppointment on the server.",
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description:
                                "Appointment created. Response may include payment URL.",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/appointment/pay-later": {
                post: {
                    tags: ["Appointment"],
                    summary: "Book appointment (pay later)",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Appointment created",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/appointment/my-appointment": {
                get: {
                    tags: ["Appointment"],
                    summary: "Get my appointments",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "My appointments",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/appointment/{id}/initiate-payment": {
                post: {
                    tags: ["Appointment"],
                    summary: "Initiate payment for appointment",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Payment initiated",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/appointment/status/{id}": {
                patch: {
                    tags: ["Appointment"],
                    summary: "Change appointment status",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Updated",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // PAYMENT
            // -----------------
            "/webhook": {
                post: {
                    tags: ["Stripe"],
                    summary: "Stripe webhook",
                    description:
                        "Receives Stripe webhook events. Uses raw body and signature verification.",
                    responses: {
                        "200": {
                            description: "Acknowledged",
                        },
                        "400": {
                            description: "Signature verification failed",
                        },
                    },
                },
            },
            "/api/v1/payment/ipn": {
                get: {
                    tags: ["Payment"],
                    summary: "IPN validation callback",
                    description:
                        "Used by Postman verification and local flows.",
                    parameters: [
                        {
                            name: "transactionId",
                            in: "query",
                            required: true,
                            schema: { type: "string" },
                        },
                        {
                            name: "status",
                            in: "query",
                            required: false,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Validated",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/payment/stripe/validate": {
                get: {
                    tags: ["Payment"],
                    summary: "Validate Stripe checkout session",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "session_id",
                            in: "query",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Validated",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // PRESCRIPTION
            // -----------------
            "/api/v1/prescription": {
                get: {
                    tags: ["Prescription"],
                    summary: "Get all prescriptions",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Prescriptions",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                post: {
                    tags: ["Prescription"],
                    summary: "Create prescription",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Created",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/prescription/my-prescription": {
                get: {
                    tags: ["Prescription"],
                    summary: "Get my prescriptions",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "My prescriptions",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // REVIEW
            // -----------------
            "/api/v1/review": {
                get: {
                    tags: ["Review"],
                    summary: "Get reviews",
                    description: "Public. Supports doctorId/patientId filters.",
                    parameters: [
                        ...PaginationQueryParams,
                        {
                            name: "doctorId",
                            in: "query",
                            required: false,
                            schema: { type: "string" },
                        },
                        {
                            name: "patientId",
                            in: "query",
                            required: false,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Reviews",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
                post: {
                    tags: ["Review"],
                    summary: "Create review",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": jsonContent({
                                type: "object",
                                additionalProperties: true,
                            }),
                        },
                    },
                    responses: {
                        "200": {
                            description: "Created",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // META
            // -----------------
            "/api/v1/meta": {
                get: {
                    tags: ["Meta"],
                    summary: "Dashboard statistics",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    responses: {
                        "200": {
                            description: "Statistics",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/meta/patient-summary": {
                get: {
                    tags: ["Meta"],
                    summary: "Patient dashboard summary",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    responses: {
                        "200": {
                            description: "Summary",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },

            // -----------------
            // NOTIFICATION
            // -----------------
            "/api/v1/notification/my-notifications": {
                get: {
                    tags: ["Notification"],
                    summary: "Get my notifications",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: PaginationQueryParams,
                    responses: {
                        "200": {
                            description: "Notifications",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/notification/mark-all-read": {
                patch: {
                    tags: ["Notification"],
                    summary: "Mark all notifications as read",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    responses: {
                        "200": {
                            description: "Marked",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
            "/api/v1/notification/{id}/read": {
                patch: {
                    tags: ["Notification"],
                    summary: "Mark notification as read",
                    security: [{ accessToken: [] }, { cookieAuth: [] }],
                    parameters: [
                        {
                            name: "id",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                        },
                    ],
                    responses: {
                        "200": {
                            description: "Marked",
                            content: {
                                "application/json":
                                    jsonContent(ApiResponseSchema),
                            },
                        },
                    },
                },
            },
        },
    };

    return spec;
}
