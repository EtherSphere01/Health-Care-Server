import express from "express";
import { apiLimiter } from "../middlewares/rateLimiter";
import { AdminRoutes } from "../modules/admin/admin.routes";
import { userRoutes } from "../modules/user/user.routes";
import { AuthRoutes } from "../modules/auth/auth.routes";
import { SpecialtiesRoutes } from "../modules/specialties/specialties.routes";
import { DoctorRoutes } from "../modules/doctor/doctor.routes";
import { PatientRoutes } from "../modules/patient/patient.route";
import { ScheduleRoutes } from "../modules/schedule/schedule.routes";
import { DoctorScheduleRoutes } from "../modules/doctorSchedule/doctorSchedule.routes";
import { AppointmentRoutes } from "../modules/appointment/appointment.routes";
import { PaymentRoutes } from "../modules/payment/payment.routes";
import { PrescriptionRoutes } from "../modules/prescription/prescription.routes";
import { ReviewRoutes } from "../modules/review/review.routes";
import { MetaRoutes } from "../modules/meta/meta.routes";

const router = express.Router();

const disableRateLimit =
    process.env.DISABLE_RATE_LIMIT === "1" ||
    process.env.ENABLE_TEST_ENDPOINTS === "1";

if (!disableRateLimit) {
    router.use(apiLimiter); // Apply to all routes
}

const moduleRoutes = [
    {
        path: "/user",
        route: userRoutes,
    },
    {
        path: "/admin",
        route: AdminRoutes,
    },
    {
        path: "/auth",
        route: AuthRoutes,
    },
    {
        path: "/specialties",
        route: SpecialtiesRoutes,
    },
    {
        path: "/doctor",
        route: DoctorRoutes,
    },
    {
        path: "/patient",
        route: PatientRoutes,
    },
    {
        path: "/schedule",
        route: ScheduleRoutes,
    },
    {
        path: "/doctor-schedule",
        route: DoctorScheduleRoutes,
    },
    {
        path: "/appointment",
        route: AppointmentRoutes,
    },
    {
        path: "/payment",
        route: PaymentRoutes,
    },
    {
        path: "/prescription",
        route: PrescriptionRoutes,
    },
    {
        path: "/review",
        route: ReviewRoutes,
    },
    {
        path: "/meta",
        route: MetaRoutes,
    },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
