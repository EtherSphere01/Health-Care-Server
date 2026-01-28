import express from "express";
import { doctorScheduleController } from "./doctorSchedule.controller";
import authMiddleware from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = express.Router();

router.post(
    "/",
    authMiddleware(UserRole.DOCTOR),
    doctorScheduleController.insertIntoDB,
);

router.get(
    "/",
    authMiddleware(UserRole.DOCTOR),
    doctorScheduleController.schedulesForDoctor,
);

router.delete(
    "/:scheduleId",
    authMiddleware(UserRole.DOCTOR),
    doctorScheduleController.deleteDoctorScheduleFromDB,
);

export const doctorSchedule = router;
