import express from "express";
import authMiddleware from "../../middlewares/auth";
import { UserRole } from "@prisma/client";
import { patientController } from "./patient.controller";

const router = express.Router();

router.get("/", authMiddleware(UserRole.ADMIN), patientController.getAllFromDB);

router.get(
    "/:id",
    authMiddleware(UserRole.ADMIN, UserRole.PATIENT),
    patientController.getByIdFromDB,
);

router.patch(
    "/:id",
    authMiddleware(UserRole.ADMIN, UserRole.PATIENT),
    patientController.updateIntoDB,
);

router.delete(
    "/:id",
    authMiddleware(UserRole.ADMIN),
    patientController.deleteFromDB,
);

export const patientRoutes = router;
