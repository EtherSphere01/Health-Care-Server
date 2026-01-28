import express from "express";
import { scheduleController } from "./schedule.controller";
import authMiddleware from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = express.Router();

router.get(
    "/",
    authMiddleware(UserRole.ADMIN, UserRole.DOCTOR),
    scheduleController.schedulesForDoctor,
);

router.post(
    "/",
    authMiddleware(UserRole.ADMIN),
    scheduleController.insertIntoDB,
);

router.delete(
    "/:id",
    authMiddleware(UserRole.ADMIN),
    scheduleController.deleteScheduleFromDB,
);

export const scheduleRoutes = router;
