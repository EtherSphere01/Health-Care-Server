import z from "zod";

const createDoctorScheduleValidationSchema = z.object({
    body: z.object({
        scheduleIds: z
            .array(
                z
                    .string()
                    .uuid({ message: "Each scheduleId must be a valid UUID" }),
            )
            .min(1, { message: "scheduleIds array cannot be empty" }),
    }),
});

export const doctorScheduleValidation = {
    createDoctorScheduleValidationSchema,
};
