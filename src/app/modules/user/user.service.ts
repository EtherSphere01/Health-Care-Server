import {
    Admin,
    Doctor,
    Patient,
    Prisma,
    UserRole,
    UserStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { Request } from "express";
import httpStatus from "http-status";
import config from "../../../config";
import { fileUploader } from "../../../helpers/fileUploader";
import { paginationHelper } from "../../../helpers/paginationHelper";
import prisma from "../../../shared/prisma";
import { IAuthUser } from "../../interfaces/common";
import { IPaginationOptions } from "../../interfaces/pagination";
import ApiError from "../../errors/ApiError";
import { userSearchAbleFields } from "./user.constant";

function pickAllowed<T extends Record<string, unknown>>(
    input: T,
    allowedKeys: string[],
) {
    const out: Record<string, unknown> = {};
    for (const key of allowedKeys) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            out[key] = input[key];
        }
    }
    return out;
}

const createAdmin = async (req: Request): Promise<Admin> => {
    const file = req.file;

    if (file) {
        const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
        req.body.admin.profilePhoto = uploadToCloudinary?.secure_url;
    }

    const hashedPassword: string = await bcrypt.hash(
        req.body.password,
        Number(config.salt_round),
    );

    const userData = {
        email: req.body.admin.email,
        password: hashedPassword,
        role: UserRole.ADMIN,
    };

    const result = await prisma.$transaction(async (transactionClient) => {
        await transactionClient.user.create({
            data: userData,
        });

        const createdAdminData = await transactionClient.admin.create({
            data: req.body.admin,
        });

        return createdAdminData;
    });

    return result;
};

const createDoctor = async (req: Request): Promise<Doctor> => {
    const file = req.file;

    if (file) {
        const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
        req.body.doctor.profilePhoto = uploadToCloudinary?.secure_url;
    }

    const hashedPassword: string = await bcrypt.hash(
        req.body.password,
        Number(config.salt_round),
    );

    const userData = {
        email: req.body.doctor.email,
        password: hashedPassword,
        role: UserRole.DOCTOR,
    };

    // Extract specialties from doctor data
    const { specialties, ...doctorData } = req.body.doctor;

    const result = await prisma.$transaction(async (transactionClient) => {
        // Step 1: Create user
        await transactionClient.user.create({
            data: userData,
        });

        // Step 2: Create doctor
        const createdDoctorData = await transactionClient.doctor.create({
            data: doctorData,
        });

        // Step 3: Create doctor specialties if provided
        if (
            specialties &&
            Array.isArray(specialties) &&
            specialties.length > 0
        ) {
            // Verify all specialties exist
            const existingSpecialties =
                await transactionClient.specialties.findMany({
                    where: {
                        id: {
                            in: specialties,
                        },
                    },
                    select: {
                        id: true,
                    },
                });

            const existingSpecialtyIds = existingSpecialties.map((s) => s.id);
            const invalidSpecialties = specialties.filter(
                (id) => !existingSpecialtyIds.includes(id),
            );

            if (invalidSpecialties.length > 0) {
                throw new Error(
                    `Invalid specialty IDs: ${invalidSpecialties.join(", ")}`,
                );
            }

            // Create doctor specialties relations
            const doctorSpecialtiesData = specialties.map((specialtyId) => ({
                doctorId: createdDoctorData.id,
                specialitiesId: specialtyId,
            }));

            await transactionClient.doctorSpecialties.createMany({
                data: doctorSpecialtiesData,
            });
        }

        // Step 4: Return doctor with specialties
        const doctorWithSpecialties = await transactionClient.doctor.findUnique(
            {
                where: {
                    id: createdDoctorData.id,
                },
                include: {
                    doctorSpecialties: {
                        include: {
                            specialities: true,
                        },
                    },
                },
            },
        );

        return doctorWithSpecialties!;
    });

    return result;
};

const createPatient = async (req: Request): Promise<Patient> => {
    const file = req.file;

    if (file) {
        const uploadedProfileImage =
            await fileUploader.uploadToCloudinary(file);
        req.body.patient.profilePhoto = uploadedProfileImage?.secure_url;
    }

    const hashedPassword: string = await bcrypt.hash(
        req.body.password,
        Number(config.salt_round),
    );

    const existingUser = await prisma.user.findUnique({
        where: {
            email: req.body.patient.email,
        },
    });

    if (existingUser) {
        throw new Error("User with this email already exists");
    }

    const userData = {
        email: req.body.patient.email,
        password: hashedPassword,
        role: UserRole.PATIENT,
    };

    const result = await prisma.$transaction(async (transactionClient) => {
        await transactionClient.user.create({
            data: {
                ...userData,
                needPasswordChange: false,
            },
        });

        const createdPatientData = await transactionClient.patient.create({
            data: req.body.patient,
        });

        return createdPatientData;
    });

    return result;
};

const getAllFromDB = async (params: any, options: IPaginationOptions) => {
    const { page, limit, skip } = paginationHelper.calculatePagination(options);
    const { searchTerm, ...filterData } = params;

    const andConditions: Prisma.UserWhereInput[] = [];

    if (params.searchTerm) {
        andConditions.push({
            OR: userSearchAbleFields.map((field) => ({
                [field]: {
                    contains: params.searchTerm,
                    mode: "insensitive",
                },
            })),
        });
    }

    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map((key) => ({
                [key]: {
                    equals: (filterData as any)[key],
                },
            })),
        });
    }

    const whereConditions: Prisma.UserWhereInput =
        andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.user.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy:
            options.sortBy && options.sortOrder
                ? {
                      [options.sortBy]: options.sortOrder,
                  }
                : {
                      createdAt: "desc",
                  },
        select: {
            id: true,
            email: true,
            role: true,
            needPasswordChange: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            admin: true,
            patient: true,
            doctor: true,
        },
    });

    const total = await prisma.user.count({
        where: whereConditions,
    });

    return {
        meta: {
            page,
            limit,
            total,
        },
        data: result,
    };
};

const changeProfileStatus = async (id: string, status: UserRole) => {
    const userData = await prisma.user.findUniqueOrThrow({
        where: {
            id,
        },
    });

    const updateUserStatus = await prisma.user.update({
        where: {
            id,
        },
        data: status,
    });

    return updateUserStatus;
};

const getMyProfile = async (user: IAuthUser) => {
    const result = await prisma.user.findUniqueOrThrow({
        where: {
            email: user?.email,
            status: UserStatus.ACTIVE,
        },
        select: {
            id: true,
            email: true,
            needPasswordChange: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            admin: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    contactNumber: true,
                    isDeleted: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            doctor: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    contactNumber: true,
                    address: true,
                    registrationNumber: true,
                    experience: true,
                    gender: true,
                    appointmentFee: true,
                    qualification: true,
                    currentWorkingPlace: true,
                    designation: true,
                    averageRating: true,
                    isDeleted: true,
                    createdAt: true,
                    updatedAt: true,
                    doctorSpecialties: {
                        include: {
                            specialities: true,
                        },
                    },
                },
            },
            patient: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    profilePhoto: true,
                    contactNumber: true,
                    address: true,
                    isDeleted: true,
                    createdAt: true,
                    updatedAt: true,
                    patientHealthData: true,
                    medicalReport: {
                        select: {
                            id: true,
                            patientId: true,
                            reportName: true,
                            reportLink: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                    },
                },
            },
        },
    });

    return result;
};

const updateMyProfie = async (user: IAuthUser, req: Request) => {
    const userInfo = await prisma.user.findUniqueOrThrow({
        where: {
            email: user?.email,
            status: UserStatus.ACTIVE,
        },
    });

    const file = req.file;
    if (file) {
        const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
        req.body.profilePhoto = uploadToCloudinary?.secure_url;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    // Never allow changing unique identifiers via "update my profile".
    delete (body as any).id;
    delete (body as any).email;
    delete (body as any).createdAt;
    delete (body as any).updatedAt;

    if (
        userInfo.role === UserRole.SUPER_ADMIN ||
        userInfo.role === UserRole.ADMIN
    ) {
        const allowed = pickAllowed(body, [
            "name",
            "contactNumber",
            "profilePhoto",
        ]);

        await prisma.admin.update({
            where: { email: userInfo.email },
            data: allowed,
        });

        return getMyProfile(user);
    }

    if (userInfo.role === UserRole.DOCTOR) {
        const allowed = pickAllowed(body, [
            "name",
            "contactNumber",
            "address",
            "registrationNumber",
            "experience",
            "gender",
            "appointmentFee",
            "qualification",
            "currentWorkingPlace",
            "designation",
            "profilePhoto",
        ]);

        await prisma.doctor.update({
            where: { email: userInfo.email },
            data: allowed,
        });

        return getMyProfile(user);
    }

    if (userInfo.role === UserRole.PATIENT) {
        const patientHealthDataRaw = (body as any).patientHealthData;
        delete (body as any).patientHealthData;

        const allowedPatient = pickAllowed(body, [
            "name",
            "contactNumber",
            "address",
            "profilePhoto",
        ]);

        // Upsert health data if provided
        const shouldUpsertHealthData =
            patientHealthDataRaw && typeof patientHealthDataRaw === "object";

        if (shouldUpsertHealthData) {
            const patient = await prisma.patient.findUnique({
                where: { email: userInfo.email },
                select: { id: true },
            });

            if (!patient?.id) {
                throw new ApiError(
                    httpStatus.NOT_FOUND,
                    "Patient profile not found",
                );
            }

            const allowedHealthData = pickAllowed(patientHealthDataRaw as any, [
                "gender",
                "dateOfBirth",
                "bloodGroup",
                "hasAllergies",
                "hasDiabetes",
                "height",
                "weight",
                "smokingStatus",
                "dietaryPreferences",
                "pregnancyStatus",
                "mentalHealthHistory",
                "immunizationStatus",
                "hasPastSurgeries",
                "recentAnxiety",
                "recentDepression",
                "maritalStatus",
            ]);

            await prisma.patient.update({
                where: { email: userInfo.email },
                data: {
                    ...allowedPatient,
                    patientHealthData: {
                        upsert: {
                            create: {
                                ...allowedHealthData,
                                patientId: patient.id,
                            },
                            update: allowedHealthData,
                        },
                    },
                },
            });
        } else {
            await prisma.patient.update({
                where: { email: userInfo.email },
                data: allowedPatient,
            });
        }

        return getMyProfile(user);
    }

    throw new ApiError(httpStatus.FORBIDDEN, "You are not authorized");
};

export const userService = {
    createAdmin,
    createDoctor,
    createPatient,
    getAllFromDB,
    changeProfileStatus,
    getMyProfile,
    updateMyProfie,
};
