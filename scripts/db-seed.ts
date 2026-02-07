import {
    Gender,
    NotificationType,
    PaymentStatus,
    UserRole,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import prisma from "../src/shared/prisma";

function pick<T>(arr: T[], index: number): T {
    return arr[index % arr.length];
}

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function makeEmail(prefix: string, i: number) {
    return `${prefix}${pad2(i)}@example.com`;
}

function makePhone(i: number) {
    return `01${String(100000000 + i).slice(0, 9)}`;
}

function addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60 * 1000);
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function wipeDatabase() {
    // Delete dependents first to satisfy foreign keys.
    await prisma.payment.deleteMany();
    await prisma.review.deleteMany();
    await prisma.prescription.deleteMany();
    await prisma.appointment.deleteMany();

    await prisma.doctorSchedules.deleteMany();
    await prisma.schedule.deleteMany();

    await prisma.doctorSpecialties.deleteMany();
    await prisma.specialties.deleteMany();

    await prisma.notification.deleteMany();
    await prisma.medicalReport.deleteMany();
    await prisma.patientHealthData.deleteMany();
    await prisma.patientRegistrationOtp.deleteMany();

    await prisma.admin.deleteMany();
    await prisma.doctor.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.user.deleteMany();
}

async function seed() {
    const saltRounds = Number(process.env.SALT_ROUND || 10);
    const defaultPassword = process.env.SEED_DEFAULT_PASSWORD || "123456";
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

    console.log("🧹 Wiping database...");
    await wipeDatabase();

    console.log("🏷️  Seeding specialties...");
    const specialtyTitles = [
        "Cardiology",
        "Neurology",
        "Pediatrics",
        "Orthopedics",
        "Dermatology",
        "Oncology",
        "Radiology",
        "ENT",
        "Ophthalmology",
        "Urology",
        "Gastroenterology",
        "Endocrinology",
        "Psychiatry",
        "Pulmonology",
        "Nephrology",
        "Rheumatology",
        "Hematology",
        "Allergy & Immunology",
        "General Medicine",
        "Family Medicine",
        "Emergency Medicine",
        "Anesthesiology",
        "Pathology",
        "Geriatrics",
    ];

    const specialties = await Promise.all(
        specialtyTitles.map((title, i) =>
            prisma.specialties.create({
                data: {
                    title,
                    // Intentionally leave some icons empty to test frontend fallbacks
                    icon: i % 3 === 0 ? null : undefined,
                },
            }),
        ),
    );

    console.log("👤 Seeding admins...");
    const adminNames = ["Admin", "System Admin", "Operations Admin"];
    await Promise.all(
        adminNames.map((name, idx) =>
            prisma.user.create({
                data: {
                    email:
                        idx === 0 ? "admin@gmail.com" : makeEmail("admin", idx),
                    password: hashedPassword,
                    role: UserRole.ADMIN,
                    needPasswordChange: false,
                    admin: {
                        create: {
                            name,
                            contactNumber: makePhone(900 + idx),
                            profilePhoto: null,
                        },
                    },
                },
            }),
        ),
    );

    console.log("🩺 Seeding doctors (20)...");
    const firstNames = [
        "Ava",
        "Noah",
        "Liam",
        "Mia",
        "Ethan",
        "Olivia",
        "Sophia",
        "James",
        "Amelia",
        "Lucas",
    ];
    const lastNames = [
        "Rahman",
        "Ahmed",
        "Chowdhury",
        "Khan",
        "Hossain",
        "Islam",
        "Das",
        "Roy",
        "Sarker",
        "Mandal",
    ];
    const designations = [
        "Consultant",
        "Senior Consultant",
        "Specialist",
        "Associate Professor",
        "Professor",
    ];
    const workplaces = [
        "Nexus Health Hospital",
        "City Medical Center",
        "Green Valley Clinic",
        "Central Care Hospital",
        "Lakeview Medical Institute",
    ];
    const qualifications = ["MBBS", "MBBS, FCPS", "MBBS, MD", "MBBS, MS"];

    const doctors = await Promise.all(
        Array.from({ length: 20 }).map((_, i) => {
            const name = `Dr. ${pick(firstNames, i)} ${pick(lastNames, i + 3)}`;
            const email = makeEmail("doctor", i + 1);
            const gender = i % 2 === 0 ? Gender.MALE : Gender.FEMALE;
            const experience = 3 + (i % 18);

            return prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role: UserRole.DOCTOR,
                    needPasswordChange: false,
                    doctor: {
                        create: {
                            name,
                            profilePhoto: i % 4 === 0 ? null : undefined,
                            contactNumber: makePhone(100 + i),
                            address: `House ${10 + i}, Road ${3 + (i % 10)}, Dhaka`,
                            registrationNumber: `REG-${2026}-${1000 + i}`,
                            experience,
                            gender,
                            appointmentFee: 500 + (i % 10) * 100,
                            qualification: pick(qualifications, i),
                            currentWorkingPlace: pick(workplaces, i),
                            designation: pick(designations, i),
                            averageRating: 3.8 + (i % 12) * 0.1,
                        },
                    },
                },
                include: { doctor: true },
            });
        }),
    );

    const doctorProfiles = doctors.map((u) => u.doctor).filter(Boolean);

    console.log("🧩 Assigning doctor specialties...");
    // Ensure each specialty (department) has 3–8 doctors.
    // This is a many-to-many relationship, so doctors can have multiple specialties.
    const doctorSpecialtiesRows: {
        doctorId: string;
        specialitiesId: string;
    }[] = [];
    const doctorAssignedCount = new Map<string, number>();
    const used = new Set<string>();

    for (const specialty of specialties) {
        const desiredDoctorsForSpecialty = randInt(3, 8);
        const selectedDoctors = shuffle(doctorProfiles).slice(
            0,
            Math.min(desiredDoctorsForSpecialty, doctorProfiles.length),
        );

        for (const doctor of selectedDoctors) {
            if (!doctor) continue;
            const key = `${doctor.id}:${specialty.id}`;
            if (used.has(key)) continue;
            used.add(key);
            doctorSpecialtiesRows.push({
                doctorId: doctor.id,
                specialitiesId: specialty.id,
            });
            doctorAssignedCount.set(
                doctor.id,
                (doctorAssignedCount.get(doctor.id) ?? 0) + 1,
            );
        }
    }

    // Ensure every doctor has at least one specialty.
    for (const doctor of doctorProfiles) {
        if (!doctor) continue;
        if ((doctorAssignedCount.get(doctor.id) ?? 0) > 0) continue;
        const fallback = pick(specialties, doctorProfiles.indexOf(doctor));
        const key = `${doctor.id}:${fallback.id}`;
        if (!used.has(key)) {
            used.add(key);
            doctorSpecialtiesRows.push({
                doctorId: doctor.id,
                specialitiesId: fallback.id,
            });
        }
    }

    await prisma.doctorSpecialties.createMany({
        data: doctorSpecialtiesRows,
        skipDuplicates: true,
    });

    console.log("🧑‍🤝‍🧑 Seeding patients (20)...");
    const patients = await Promise.all(
        Array.from({ length: 20 }).map((_, i) => {
            const name = `${pick(firstNames, i + 2)} ${pick(lastNames, i + 5)}`;
            const email = makeEmail("patient", i + 1);

            return prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role: UserRole.PATIENT,
                    needPasswordChange: false,
                    patient: {
                        create: {
                            name,
                            profilePhoto: i % 5 === 0 ? null : undefined,
                            contactNumber: makePhone(400 + i),
                            address: `Block ${String.fromCharCode(65 + (i % 6))}, Dhaka`,
                        },
                    },
                },
                include: { patient: true },
            });
        }),
    );

    const patientProfiles = patients.map((u) => u.patient).filter(Boolean);

    console.log("📅 Seeding schedules + doctor schedules...");

    const startBase = new Date();
    startBase.setDate(startBase.getDate() + 1);
    startBase.setHours(0, 0, 0, 0);

    const end2030 = new Date();
    end2030.setFullYear(2030, 11, 31);
    end2030.setHours(23, 59, 59, 999);

    const maxDaysAhead = Math.max(
        1,
        Math.floor((end2030.getTime() - startBase.getTime()) / 86400000),
    );

    // Multiple slots per doctor across random dates up to 2030.
    const doctorScheduleRows: { doctorId: string; scheduleId: string }[] = [];

    for (let i = 0; i < doctorProfiles.length; i++) {
        const doctor = doctorProfiles[i]!;
        const usedSlots = new Set<string>();

        // 8 slots per doctor (some near-term, some long-range)
        for (let s = 0; s < 8; s++) {
            // Near-term bias for some slots so there are upcoming appointments,
            // while still keeping random availability up to 2030.
            const daysAhead =
                s < 3
                    ? randInt(1, Math.min(60, maxDaysAhead))
                    : randInt(1, maxDaysAhead);

            let slotStart: Date | null = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                const candidate = new Date(startBase);
                candidate.setDate(candidate.getDate() + daysAhead);

                const hour = randInt(8, 17);
                const minute = randInt(0, 1) * 30;
                candidate.setHours(hour, minute, 0, 0);

                const key = candidate.toISOString();
                if (usedSlots.has(key)) continue;
                usedSlots.add(key);
                slotStart = candidate;
                break;
            }

            if (!slotStart) continue;

            const schedule = await prisma.schedule.create({
                data: {
                    startDateTime: slotStart,
                    endDateTime: addMinutes(slotStart, 45),
                },
            });

            await prisma.doctorSchedules.create({
                data: {
                    doctorId: doctor.id,
                    scheduleId: schedule.id,
                    isBooked: false,
                },
            });

            doctorScheduleRows.push({
                doctorId: doctor.id,
                scheduleId: schedule.id,
            });
        }
    }

    console.log(
        "🧾 Seeding appointments (20) + payments/prescriptions/reviews...",
    );
    const appointments = [] as {
        id: string;
        doctorId: string;
        patientId: string;
        scheduleId: string;
    }[];

    for (let i = 0; i < 20; i++) {
        const doctor = doctorProfiles[i % doctorProfiles.length]!;
        const patient = patientProfiles[(i * 3) % patientProfiles.length]!;

        // pick an unbooked schedule row for this doctor
        const row = doctorScheduleRows.find((r) => r.doctorId === doctor.id);
        if (!row) continue;
        doctorScheduleRows.splice(doctorScheduleRows.indexOf(row), 1);

        const appointment = await prisma.appointment.create({
            data: {
                doctorId: doctor.id,
                patientId: patient.id,
                scheduleId: row.scheduleId,
                videoCallingId: `jitsi-${doctor.id.slice(0, 6)}-${patient.id.slice(0, 6)}-${i + 1}`,
                status: i % 6 === 0 ? "COMPLETED" : "SCHEDULED",
                paymentStatus:
                    i % 3 === 0 ? PaymentStatus.PAID : PaymentStatus.UNPAID,
            },
        });

        await prisma.doctorSchedules.update({
            where: {
                doctorId_scheduleId: {
                    doctorId: doctor.id,
                    scheduleId: row.scheduleId,
                },
            },
            data: {
                isBooked: true,
                appointmentId: appointment.id,
            },
        });

        appointments.push({
            id: appointment.id,
            doctorId: doctor.id,
            patientId: patient.id,
            scheduleId: row.scheduleId,
        });

        if (appointment.paymentStatus === PaymentStatus.PAID) {
            await prisma.payment.create({
                data: {
                    appointmentId: appointment.id,
                    amount: doctor.appointmentFee,
                    transactionId: `TXN-${Date.now()}-${i + 1}`,
                    status: PaymentStatus.PAID,
                    paymentGatewayData: { seeded: true },
                },
            });
        }

        if (i % 2 === 0) {
            await prisma.prescription.create({
                data: {
                    appointmentId: appointment.id,
                    doctorId: doctor.id,
                    patientId: patient.id,
                    instructions:
                        "Take prescribed medicines after meals. Drink plenty of water and rest.",
                    followUpDate: addMinutes(
                        new Date(),
                        60 * 24 * (14 + (i % 7)),
                    ),
                },
            });
        }

        if (i % 2 === 1) {
            await prisma.review.create({
                data: {
                    appointmentId: appointment.id,
                    doctorId: doctor.id,
                    patientId: patient.id,
                    rating: 4 + (i % 2) * 0.5,
                    comment:
                        "Very professional and helpful. Explained everything clearly.",
                },
            });
        }
    }

    console.log("🔔 Seeding notifications (min 20)...");
    for (let i = 0; i < 20; i++) {
        const role = i % 2 === 0 ? UserRole.PATIENT : UserRole.DOCTOR;
        const email =
            role === UserRole.PATIENT
                ? patientProfiles[i % patientProfiles.length]!.email
                : doctorProfiles[i % doctorProfiles.length]!.email;

        await prisma.notification.create({
            data: {
                recipientEmail: email,
                recipientRole: role,
                type: pick(
                    [
                        NotificationType.APPOINTMENT_CREATED,
                        NotificationType.PAYMENT_UPDATED,
                        NotificationType.PRESCRIPTION_CREATED,
                        NotificationType.REVIEW_CREATED,
                    ],
                    i,
                ),
                title: "Update from Nexus Health",
                message: "You have a new update in your account.",
                link: "/dashboard",
                isRead: i % 4 === 0,
            },
        });
    }

    console.log("✅ Seed complete.");
    console.log(
        `\nLogin (seeded):\n- Admin: admin@gmail.com / ${defaultPassword}\n- Example Doctor: ${doctorProfiles[0]?.email} / ${defaultPassword}\n- Example Patient: ${patientProfiles[0]?.email} / ${defaultPassword}\n`,
    );
}

seed()
    .catch((err) => {
        console.error("❌ Seed failed:", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
