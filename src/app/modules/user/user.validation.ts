import z from "zod";

const genderEnumValues = ["MALE", "FEMALE"] as const;

const createPatientValidationSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters long"),
    patient: z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        address: z.string().optional(),
    }),
});

const createDoctorValidationSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters long"),
    doctor: z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        contactNumber: z.string().min(1, "Contact number is required"),
        address: z.string().optional(),
        registrationNumber: z
            .string()
            .min(1, "Registration number is required"),
        expertise: z.number().int().nonnegative().optional(),
        gender: z.enum(genderEnumValues, {
            message: "Gender is required",
        }),
        appointmentFee: z.number().int().nonnegative({
            message: "Appointment fee must be a non-negative number",
        }),
        qualification: z.string().min(1, "Qualification is required"),
        currentWorkingPlace: z
            .string()
            .min(1, "Current working place is required"),
        designation: z.string().min(1, "Designation is required"),
    }),
});

const createAdminValidationSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters long"),
    admin: z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email address"),
        contactNumber: z.string().min(1, "Contact number is required"),
    }),
});

export const userValidation = {
    createPatientValidationSchema,
    createDoctorValidationSchema,
    createAdminValidationSchema,
};
