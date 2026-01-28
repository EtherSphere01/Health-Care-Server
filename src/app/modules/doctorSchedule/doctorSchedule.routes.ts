import express from "express";
import { doctorScheduleController } from "./doctorSchedule.controller";
import authMiddleware from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import validateRequest from "../../middlewares/validateRequest";
import { doctorScheduleValidation } from "./doctorSchedule.validation";

const router = express.Router();

router.post(
    "/",
    authMiddleware(UserRole.DOCTOR, UserRole.ADMIN),
    validateRequest(
        doctorScheduleValidation.createDoctorScheduleValidationSchema,
    ),
    doctorScheduleController.insertIntoDB,
);

router.get(
    "/",
    authMiddleware(UserRole.DOCTOR, UserRole.ADMIN),
    doctorScheduleController.schedulesForDoctor,
);

router.delete(
    "/:scheduleId",
    authMiddleware(UserRole.DOCTOR, UserRole.ADMIN),
    doctorScheduleController.deleteDoctorScheduleFromDB,
);

export const doctorSchedule = router;
