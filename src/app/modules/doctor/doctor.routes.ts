import express from "express";
import { doctorController } from "./doctor.controller";
import authMiddleware from "../../middlewares/auth";
import { UserRole } from "@prisma/client";

const router = express.Router();

router.get("/", doctorController.getAllFromDB);

router.get(
    "/:id",
    authMiddleware(UserRole.ADMIN, UserRole.DOCTOR),
    doctorController.getByIdFromDB,
);

router.patch(
    "/:id",
    authMiddleware(UserRole.ADMIN, UserRole.DOCTOR),
    doctorController.updateIntoDB,
);

router.delete(
    "/:id",
    authMiddleware(UserRole.ADMIN),
    doctorController.deleteFromDB,
);

export const doctorRoutes = router;
