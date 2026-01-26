import express, { NextFunction, Request, Response } from "express";
import { userController } from "./user.controller";
import { fileUploader } from "../../helper/fileUploader";
import { userValidation } from "./user.validation";

const router = express.Router();

export const userRoutes = router;

// get all users from database
router.get("/", userController.getAllFromDB);

router.post(
    "/create-patient",
    fileUploader.upload.single("file"),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = userValidation.createPatientValidationSchema.parse(
            JSON.parse(req.body.data),
        );
        return userController.createPatient(req, res, next);
    },
);

// create Doctor

router.post(
    "/create-doctor",
    fileUploader.upload.single("file"),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = userValidation.createDoctorValidationSchema.parse(
            JSON.parse(req.body.data),
        );
        return userController.createDoctor(req, res, next);
    },
);

// create Admin

router.post(
    "/create-admin",
    fileUploader.upload.single("file"),
    (req: Request, res: Response, next: NextFunction) => {
        req.body = userValidation.createAdminValidationSchema.parse(
            JSON.parse(req.body.data),
        );
        return userController.createAdmin(req, res, next);
    },
);
