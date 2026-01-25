import express from "express";
import { userController } from "./user.controller";

const router = express.Router();

export const userRoutes = router;

router.post("/create-patient", userController.createPatient);
