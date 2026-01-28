import { Gender } from "@prisma/client";

export type IDoctorUpdateInput = {
    email?: string;
    contactNumber?: string;
    gender?: Gender;
    appointmentFee?: number;
    name?: string;
    address?: string;
    experience?: number;
    qualification?: string;
    currentWorkingPlace?: string;
    designation?: string;
    isDeleted?: boolean;
    specialties?: [
        {
            specialtyId: string;
            isDeleted?: boolean;
        },
    ];
};
