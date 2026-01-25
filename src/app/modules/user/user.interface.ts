export type createPatientInput = {
    password: string;
    patient: {
        name: string;
        email: string;
        address?: string;
    };
};
