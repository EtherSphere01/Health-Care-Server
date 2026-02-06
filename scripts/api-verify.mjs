import fs from "node:fs";
import path from "node:path";

const DEFAULT_COLLECTION_PATH = path.resolve(
    process.cwd(),
    "Resources",
    "HealthCare-API.postman_collection.json",
);

function nowIso() {
    return new Date().toISOString();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value) {
    return typeof value === "object" && value !== null;
}

function substitute(input, vars, placeholderMap) {
    if (typeof input !== "string") return input;
    let out = input.replace(/\{\{([^}]+)\}\}/g, (_m, key) => {
        const v = vars[String(key).trim()];
        return v == null ? "" : String(v);
    });

    // Replace common placeholder IDs present in the collection bodies.
    // Important: replace longer needles first to avoid partial collisions
    // (e.g. 'specialty-uuid' would otherwise corrupt 'specialty-uuid-1').
    const entries = Object.entries(placeholderMap ?? {}).sort(
        ([a], [b]) => String(b).length - String(a).length,
    );

    for (const [needle, repl] of entries) {
        if (!repl) continue;
        out = out.split(needle).join(String(repl));
    }

    return out;
}

function mergeHeaders(headersArray) {
    const headers = new Headers();
    for (const h of headersArray ?? []) {
        if (!h || h.disabled) continue;
        const key = h.key;
        if (!key) continue;
        headers.set(key, h.value ?? "");
    }
    return headers;
}

function resolveUrl(urlObj, vars, placeholderMap) {
    if (!urlObj) throw new Error("Missing request.url");

    const variableDefaults = {};
    for (const v of urlObj.variable ?? []) {
        if (!v?.key) continue;
        variableDefaults[v.key] = substitute(
            v.value ?? "",
            vars,
            placeholderMap,
        );
    }

    const host = Array.isArray(urlObj.host)
        ? urlObj.host.join("")
        : urlObj.host;
    const base = substitute(host ?? "", vars, placeholderMap);

    const segments = [];
    for (const segRaw of urlObj.path ?? []) {
        const seg = String(segRaw);
        if (seg.startsWith(":")) {
            const key = seg.slice(1);
            const resolved = vars[key] ?? variableDefaults[key];
            if (!resolved) throw new Error(`Missing path variable :${key}`);
            segments.push(encodeURIComponent(String(resolved)));
        } else {
            segments.push(
                encodeURIComponent(substitute(seg, vars, placeholderMap)),
            );
        }
    }

    const url = new URL(base.replace(/\/$/, "") + "/" + segments.join("/"));

    for (const q of urlObj.query ?? []) {
        if (!q || q.disabled) continue;
        if (!q.key) continue;
        const value = substitute(q.value ?? "", vars, placeholderMap);
        url.searchParams.set(q.key, value);
    }

    return url.toString();
}

function pickRoleToken(url, method, tokens) {
    // Minimal role inference to make the Postman collection runnable.
    // Falls back to admin for most admin-only endpoints.
    const u = new URL(url);
    const pathname = u.pathname;

    if (pathname.includes("/api/v1/appointment")) {
        if (pathname.includes("/my-appointment")) return tokens.patient;
        if (method === "POST") return tokens.patient;
        return tokens.admin;
    }

    if (pathname.includes("/api/v1/doctor-schedule")) {
        if (method === "POST" || method === "DELETE") return tokens.doctor;
        if (pathname.endsWith("/my-schedule")) return tokens.doctor;
        return tokens.admin;
    }

    if (pathname.includes("/api/v1/schedule")) {
        if (method === "POST" || method === "DELETE") return tokens.admin;
        return tokens.admin;
    }

    if (pathname.includes("/api/v1/user")) {
        if (pathname.endsWith("/create-patient")) return tokens.admin;
        if (pathname.includes("/me"))
            return tokens.admin ?? tokens.patient ?? tokens.doctor;
        return tokens.admin;
    }

    if (pathname.includes("/api/v1/doctor")) {
        if (method === "GET") return null;
        return tokens.admin;
    }

    if (pathname.includes("/api/v1/specialties")) {
        if (method === "DELETE") return tokens.admin;
        return null;
    }

    if (pathname.includes("/api/v1/prescription")) {
        if (pathname.includes("/my-prescription")) return tokens.patient;
        if (method === "POST") return tokens.doctor;
        return tokens.admin;
    }

    if (pathname.includes("/api/v1/review")) {
        if (method === "POST") return tokens.patient;
        return null;
    }

    if (pathname.includes("/api/v1/meta")) {
        if (pathname.includes("/patient-summary")) return tokens.patient;
        return tokens.admin;
    }

    return tokens.admin;
}

async function httpRequest({ name, method, url, headers, body }) {
    const maxRetries = Number(process.env.VERIFY_MAX_RETRIES ?? 12);
    let attempt = 0;

    // Allow the backend to detect verification traffic (used to relax certain
    // dev-only constraints like payment rate limiting).
    if (headers instanceof Headers && !headers.has("x-api-verify")) {
        headers.set("x-api-verify", "1");
    }

    while (true) {
        const res = await fetch(url, {
            method,
            headers,
            body,
            redirect: "manual",
        });

        const setCookies =
            typeof res.headers.getSetCookie === "function"
                ? res.headers.getSetCookie()
                : res.headers.get("set-cookie")
                  ? [res.headers.get("set-cookie")]
                  : [];

        const contentType = res.headers.get("content-type") ?? "";
        const text = await res.text();

        let json;
        if (contentType.includes("application/json")) {
            try {
                json = JSON.parse(text);
            } catch {
                json = undefined;
            }
        }

        // Back off & retry on global rate limit.
        if (res.status === 429 && attempt < maxRetries) {
            const retryAfterHeader = res.headers.get("retry-after");
            const retryAfterSeconds = retryAfterHeader
                ? Number(retryAfterHeader)
                : NaN;
            const baseDelay = Number.isFinite(retryAfterSeconds)
                ? retryAfterSeconds * 1000
                : 1500;
            const delayMs = Math.min(
                15000,
                baseDelay * Math.pow(1.35, attempt),
            );
            attempt += 1;
            await sleep(delayMs);
            continue;
        }

        return {
            name,
            status: res.status,
            ok: res.ok,
            headers: Object.fromEntries(res.headers.entries()),
            setCookies,
            text,
            json,
        };
    }
}

function getCookieValue(setCookies, cookieName) {
    for (const sc of setCookies ?? []) {
        const m = String(sc).match(
            new RegExp(`(?:^|;)\\s*${cookieName}=([^;]+)`),
        );
        if (m?.[1]) return m[1];
        const m2 = String(sc).match(new RegExp(`^${cookieName}=([^;]+)`));
        if (m2?.[1]) return m2[1];
    }
    return undefined;
}

function printResultLine(result) {
    const status = result.ok ? "PASS" : "FAIL";
    const suffix = result.ok ? "" : ` (HTTP ${result.status})`;
    console.log(`[${status}] ${result.name}${suffix}`);

    if (!result.ok && process.env.VERBOSE_FAIL === "1") {
        const msg = result.json?.message ?? result.text;
        if (msg) console.log(`  -> ${String(msg).slice(0, 240)}`);
    }
}

function requireValue(label, value) {
    if (!value) throw new Error(`Missing required config: ${label}`);
    return value;
}

function extractId(payload) {
    // Server responses usually look like: { success, message, data: {...} }
    if (!payload) return undefined;
    const data = payload.data ?? payload;
    if (isRecord(data) && typeof data.id === "string") return data.id;
    return undefined;
}

async function runSetupFlow({ baseUrl, collectionPath }) {
    const unique = Date.now();
    const isTestMode = process.env.ENABLE_TEST_ENDPOINTS === "1";

    const vars = {
        baseUrl,
        accessToken: "",
        refreshToken: "",
        transactionId: "",
        resetToken: "",
    };

    const placeholderMap = {
        "specialty-uuid": "",
        "specialty-uuid-1": "",
        "specialty-uuid-2": "",
        "admin-uuid": "",
        "doctor-uuid": "",
        "patient-uuid": "",
        "schedule-uuid": "",
        "schedule-uuid-1": "",
        "schedule-uuid-2": "",
        "appointment-uuid": "",
        "user-uuid": "",
    };

    const adminEmail = process.env.ADMIN_EMAIL ?? "admin@gmail.com";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "123456";

    const doctorEmail =
        process.env.DOCTOR_EMAIL ?? `doctor${unique}@example.com`;
    const doctorPassword = process.env.DOCTOR_PASSWORD ?? "doctor123";

    const patientEmail =
        process.env.PATIENT_EMAIL ?? `patient${unique}@example.com`;
    const patientPassword = process.env.PATIENT_PASSWORD ?? "patient123";

    // Keep current setup credentials in vars for request overrides.
    vars.patientEmail = patientEmail;
    vars.patientPassword = patientPassword;

    // Separate user used for forgot/reset password verification (to avoid touching the main patient).
    const resetFlowEmail = `reset-flow-${unique}@example.com`;
    const resetFlowPassword = "resetFlow123";
    vars.resetFlowEmail = resetFlowEmail;
    vars.resetFlowPassword = resetFlowPassword;

    // 1) Login admin
    {
        const url = `${baseUrl}/auth/login`;
        const result = await httpRequest({
            name: "Setup: Admin login",
            method: "POST",
            url,
            headers: new Headers({ "content-type": "application/json" }),
            body: JSON.stringify({
                email: adminEmail,
                password: adminPassword,
            }),
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Admin login failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        const accessToken = getCookieValue(result.setCookies, "accessToken");
        const refreshToken = getCookieValue(result.setCookies, "refreshToken");
        requireValue("admin accessToken", accessToken);
        requireValue("admin refreshToken", refreshToken);

        vars.accessToken = accessToken;
        vars.refreshToken = refreshToken;
        printResultLine(result);
    }

    // 1b) Fetch /auth/me to capture seed user/profile IDs for placeholder substitution
    {
        const headers = new Headers();
        headers.set("authorization", vars.accessToken);

        const result = await httpRequest({
            name: "Setup: Admin auth me",
            method: "GET",
            url: `${baseUrl}/auth/me`,
            headers,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Admin auth me failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        const me = result.json?.data;
        const userId = me?.id;
        const adminId = me?.admin?.id;
        // Keep seed ids available for debugging, but avoid using them for deletes.
        if (typeof userId === "string" && userId)
            placeholderMap["seed-user-uuid"] = userId;
        if (typeof adminId === "string" && adminId)
            placeholderMap["seed-admin-uuid"] = adminId;
        printResultLine(result);
    }

    // 1c) Create a disposable admin for CRUD endpoints that require an :adminId
    {
        const tempAdminEmail = `temp-admin-${unique}@example.com`;
        const fd = new FormData();
        fd.append(
            "data",
            JSON.stringify({
                password: "admin123",
                admin: {
                    name: "Temp Admin",
                    email: tempAdminEmail,
                    contactNumber: "+10000000000",
                    address: "Temp Address",
                },
            }),
        );

        const headers = new Headers();
        headers.set("authorization", vars.accessToken);

        const result = await httpRequest({
            name: "Setup: Create disposable admin",
            method: "POST",
            url: `${baseUrl}/user/create-admin`,
            headers,
            body: fd,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Create disposable admin failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        const createdAdminId = result.json?.data?.id ?? extractId(result.json);
        if (typeof createdAdminId === "string" && createdAdminId)
            placeholderMap["admin-uuid"] = createdAdminId;

        // user/create-admin returns only the Admin record; fetch the corresponding User by email.
        const findHeaders = new Headers();
        findHeaders.set("authorization", vars.accessToken);
        const findResult = await httpRequest({
            name: "Setup: Find disposable admin user id",
            method: "GET",
            url: `${baseUrl}/user?searchTerm=${encodeURIComponent(tempAdminEmail)}&limit=5&page=1`,
            headers: findHeaders,
        });

        if (!findResult.ok) {
            printResultLine(findResult);
            throw new Error(
                `Find disposable admin user id failed (HTTP ${findResult.status}): ${findResult.text.slice(0, 300)}`,
            );
        }

        const found = findResult.json?.data;
        const createdUserId = Array.isArray(found) ? found?.[0]?.id : found?.id;
        if (typeof createdUserId === "string" && createdUserId)
            placeholderMap["user-uuid"] = createdUserId;

        printResultLine(findResult);
        printResultLine(result);
    }

    // 2) Create 2 specialties (public)
    const specialtyIds = [];
    const specialtyTitles = ["Cardiology", "Dermatology"];
    for (const title of specialtyTitles) {
        const fd = new FormData();
        fd.append(
            "data",
            JSON.stringify({ title: `${title}-${unique}`, icon: "icon-url" }),
        );

        const result = await httpRequest({
            name: `Setup: Create specialty (${title})`,
            method: "POST",
            url: `${baseUrl}/specialties`,
            headers: new Headers(),
            body: fd,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Create specialty failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        const createdId = extractId(result.json);
        requireValue("specialty id", createdId);
        specialtyIds.push(createdId);
        printResultLine(result);
    }

    placeholderMap["specialty-uuid"] = specialtyIds[0];
    placeholderMap["specialty-uuid-1"] = specialtyIds[0];
    placeholderMap["specialty-uuid-2"] = specialtyIds[1];
    // Doctor update request placeholders in the Postman collection.
    placeholderMap["new-specialty-uuid-1"] = specialtyIds[0];
    placeholderMap["new-specialty-uuid-2"] = specialtyIds[1];
    placeholderMap["old-specialty-uuid"] = specialtyIds[0];

    // 3) Create doctor (admin)
    let doctorId;
    {
        const fd = new FormData();
        fd.append(
            "data",
            JSON.stringify({
                password: doctorPassword,
                doctor: {
                    name: "Dr. John Smith",
                    email: doctorEmail,
                    contactNumber: "+1234567890",
                    address: "123 Medical Plaza",
                    registrationNumber: `REG-${unique}`,
                    experience: 10,
                    gender: "MALE",
                    appointmentFee: 500,
                    qualification: "MBBS, MD",
                    currentWorkingPlace: "City Hospital",
                    designation: "Senior Cardiologist",
                    specialties: specialtyIds,
                },
            }),
        );

        const headers = new Headers();
        headers.set("authorization", vars.accessToken);

        const result = await httpRequest({
            name: "Setup: Create doctor",
            method: "POST",
            url: `${baseUrl}/user/create-doctor`,
            headers,
            body: fd,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Create doctor failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        doctorId =
            result.json?.data?.id ??
            result.json?.data?.doctor?.id ??
            result.json?.data?.doctorId ??
            extractId(result.json);
        requireValue("doctorId", doctorId);

        placeholderMap["doctor-uuid"] = doctorId;
        printResultLine(result);
    }

    // 4) Login doctor
    let doctorToken;
    {
        const result = await httpRequest({
            name: "Setup: Doctor login",
            method: "POST",
            url: `${baseUrl}/auth/login`,
            headers: new Headers({ "content-type": "application/json" }),
            body: JSON.stringify({
                email: doctorEmail,
                password: doctorPassword,
            }),
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Doctor login failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        doctorToken = getCookieValue(result.setCookies, "accessToken");
        requireValue("doctor accessToken", doctorToken);
        printResultLine(result);
    }

    // 5) Create schedule (admin)
    let scheduleIds = [];
    {
        // Appointments have a unique constraint on scheduleId, so we create schedules
        // on a future date to avoid collisions across repeated verification runs.
        const daysAhead = 180 + (unique % 30);
        const targetDate = new Date(
            Date.now() + daysAhead * 24 * 60 * 60 * 1000,
        );
        const yyyyMmDd = targetDate.toISOString().slice(0, 10);

        const headers = new Headers({ "content-type": "application/json" });
        headers.set("authorization", vars.accessToken);

        const pad2 = (n) => String(n).padStart(2, "0");
        // Vary the time window per run to avoid reusing existing schedule slots.
        // Retry a few times if the window overlaps with existing slots.
        const wanted = 12;
        const maxAttempts = 5;
        const idSet = new Set();

        let lastCreateResult = null;

        for (
            let attempt = 0;
            attempt < maxAttempts && idSet.size < wanted;
            attempt++
        ) {
            const startHour = 6 + ((unique + attempt * 3) % 10); // 06:00..15:00
            const endHour = startHour + 6; // 6h => 12 slots at 30m
            const startTime = `${pad2(startHour)}:00`;
            const endTime = `${pad2(endHour)}:00`;

            const result = await httpRequest({
                name: `Setup: Create schedule (attempt ${attempt + 1})`,
                method: "POST",
                url: `${baseUrl}/schedule`,
                headers,
                body: JSON.stringify({
                    startDate: yyyyMmDd,
                    endDate: yyyyMmDd,
                    startTime,
                    endTime,
                }),
            });

            lastCreateResult = result;

            if (!result.ok) {
                printResultLine(result);
                continue;
            }

            const created = result.json?.data;
            const createdIds = Array.isArray(created)
                ? created.map((s) => s?.id).filter(Boolean)
                : [];
            for (const id of createdIds) idSet.add(id);

            // If nothing was created (all slots already existed), fall back to listing the day.
            if (createdIds.length === 0) {
                const listHeaders = new Headers();
                listHeaders.set("authorization", vars.accessToken);
                const listResult = await httpRequest({
                    name: "Setup: Fetch schedule fallback",
                    method: "GET",
                    url: `${baseUrl}/schedule?startDate=${encodeURIComponent(yyyyMmDd)}&endDate=${encodeURIComponent(yyyyMmDd)}&limit=100&page=1`,
                    headers: listHeaders,
                });

                if (!listResult.ok) {
                    printResultLine(listResult);
                } else {
                    const listData = listResult.json?.data;
                    const listIds = Array.isArray(listData)
                        ? listData.map((s) => s?.id).filter(Boolean)
                        : [];
                    for (const id of listIds) idSet.add(id);
                    printResultLine(listResult);
                }
            }

            printResultLine(result);
        }

        scheduleIds = Array.from(idSet);

        if (scheduleIds.length < 5) {
            if (lastCreateResult) printResultLine(lastCreateResult);
            throw new Error(
                `Not enough schedules available for verification (need 5+, got ${scheduleIds.length}).`,
            );
        }

        // Reserve a deletable schedule ID for the Postman "Schedule Module" CRUD.
        // We keep appointment booking on a separate placeholder (schedule-uuid).
        placeholderMap["schedule-delete-uuid"] =
            scheduleIds[scheduleIds.length - 1];
    }

    // 6) Assign schedule to doctor (doctor)
    {
        const headers = new Headers({ "content-type": "application/json" });
        headers.set("authorization", doctorToken);

        const result = await httpRequest({
            name: "Setup: Doctor add schedule",
            method: "POST",
            url: `${baseUrl}/doctor-schedule`,
            headers,
            body: JSON.stringify({
                scheduleIds: scheduleIds.slice(
                    0,
                    Math.min(8, scheduleIds.length),
                ),
            }),
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Doctor add schedule failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        printResultLine(result);
    }

    // 6b) Fetch doctor's schedules to pick unbooked slots reliably
    let unbookedScheduleIds = [];
    {
        const headers = new Headers();
        headers.set("authorization", doctorToken);
        const result = await httpRequest({
            name: "Setup: Fetch doctor my-schedule",
            method: "GET",
            url: `${baseUrl}/doctor-schedule/my-schedule?limit=50&page=1`,
            headers,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Fetch doctor my-schedule failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        const data = result.json?.data;
        const items = Array.isArray(data) ? data : data?.data;
        const arr = Array.isArray(items) ? items : [];

        unbookedScheduleIds = arr
            .filter((ds) => ds && ds.isBooked === false)
            .map((ds) => ds?.scheduleId ?? ds?.schedule?.id)
            .filter(Boolean);

        printResultLine(result);
    }

    if (unbookedScheduleIds.length < 3) {
        throw new Error(
            `Not enough unbooked doctor schedules available (need 3+, got ${unbookedScheduleIds.length}).`,
        );
    }

    const scheduleIdForPayNow = unbookedScheduleIds[0];
    const scheduleIdForPayLater = unbookedScheduleIds[1];
    placeholderMap["schedule-uuid"] = unbookedScheduleIds[2];
    placeholderMap["schedule-uuid-1"] =
        unbookedScheduleIds[3] ?? unbookedScheduleIds[2];
    placeholderMap["schedule-uuid-2"] =
        unbookedScheduleIds[4] ?? unbookedScheduleIds[2];

    // 7) Create patient
    let patientId;
    {
        let result;
        if (isTestMode) {
            const requestOtp = await httpRequest({
                name: "Setup: Patient registration request OTP",
                method: "POST",
                url: `${baseUrl}/auth/register-patient/request-otp`,
                headers: new Headers({ "content-type": "application/json" }),
                body: JSON.stringify({
                    name: "Patient Name",
                    email: patientEmail,
                    password: patientPassword,
                }),
            });

            if (!requestOtp.ok) {
                printResultLine(requestOtp);
                throw new Error(
                    `Request patient OTP failed (HTTP ${requestOtp.status}): ${requestOtp.text.slice(0, 300)}`,
                );
            }
            printResultLine(requestOtp);
            const otp = requestOtp.json?.data?.otp;
            if (!otp) throw new Error("Missing OTP from request-otp response");

            result = await httpRequest({
                name: "Setup: Patient registration verify OTP",
                method: "POST",
                url: `${baseUrl}/auth/register-patient/verify-otp`,
                headers: new Headers({ "content-type": "application/json" }),
                body: JSON.stringify({
                    email: patientEmail,
                    otp,
                }),
            });
        } else {
            const fd = new FormData();
            fd.append(
                "data",
                JSON.stringify({
                    password: patientPassword,
                    patient: {
                        name: "Patient Name",
                        email: patientEmail,
                        contactNumber: "+1234567890",
                        address: "123 Main St",
                    },
                }),
            );

            const headers = new Headers();
            headers.set("authorization", vars.accessToken);

            result = await httpRequest({
                name: "Setup: Create patient",
                method: "POST",
                url: `${baseUrl}/user/create-patient`,
                headers,
                body: fd,
            });
        }

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Create patient failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        patientId =
            result.json?.data?.id ??
            result.json?.data?.patient?.id ??
            result.json?.data?.patientId ??
            extractId(result.json);

        if (!patientId) {
            const headers = new Headers();
            headers.set("authorization", vars.accessToken);
            const lookup = await httpRequest({
                name: "Setup: Find patient id",
                method: "GET",
                url: `${baseUrl}/user?searchTerm=${encodeURIComponent(patientEmail)}&limit=5&page=1`,
                headers,
            });

            if (!lookup.ok) {
                printResultLine(lookup);
                throw new Error(
                    `Find patient id failed (HTTP ${lookup.status}): ${lookup.text.slice(0, 300)}`,
                );
            }

            const arr = Array.isArray(lookup.json?.data)
                ? lookup.json.data
                : [];
            const match = arr.find((u) => u && u.email === patientEmail);
            patientId = match?.patient?.id ?? match?.patientId;
            printResultLine(lookup);
        }

        if (patientId) placeholderMap["patient-uuid"] = patientId;
        printResultLine(result);
    }

    // 7b) Create a reset-flow patient (only needed for full verification in test mode)
    if (isTestMode) {
        const fd = new FormData();
        fd.append(
            "data",
            JSON.stringify({
                password: resetFlowPassword,
                patient: {
                    name: "Reset Flow Patient",
                    email: resetFlowEmail,
                    contactNumber: "+1234567000",
                    address: "Reset Flow Address",
                },
            }),
        );

        const headers = new Headers();
        headers.set("authorization", vars.accessToken);

        const result = await httpRequest({
            name: "Setup: Create reset-flow patient",
            method: "POST",
            url: `${baseUrl}/user/create-patient`,
            headers,
            body: fd,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Create reset-flow patient failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        printResultLine(result);
    }

    // 8) Login patient
    let patientToken;
    {
        const result = await httpRequest({
            name: "Setup: Patient login",
            method: "POST",
            url: `${baseUrl}/auth/login`,
            headers: new Headers({ "content-type": "application/json" }),
            body: JSON.stringify({
                email: patientEmail,
                password: patientPassword,
            }),
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Patient login failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        patientToken = getCookieValue(result.setCookies, "accessToken");
        requireValue("patient accessToken", patientToken);
        printResultLine(result);
    }

    // 9) Create appointment (patient)
    {
        const headers = new Headers({ "content-type": "application/json" });
        headers.set("authorization", patientToken);

        const result = await httpRequest({
            name: "Setup: Create appointment (immediate payment)",
            method: "POST",
            url: `${baseUrl}/appointment`,
            headers,
            body: JSON.stringify({ doctorId, scheduleId: scheduleIdForPayNow }),
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Create appointment failed (HTTP ${result.status}): ${result.text.slice(0, 400)}`,
            );
        }

        // Endpoint returns { paymentUrl }, not the appointment id.
        const paymentUrl = result.json?.data?.paymentUrl;
        requireValue("paymentUrl", paymentUrl);
        printResultLine(result);
    }

    // 9b) Create pay-later appointment so we have a stable appointmentId for initiate-payment
    let appointmentId;
    {
        const headers = new Headers({ "content-type": "application/json" });
        headers.set("authorization", patientToken);

        const result = await httpRequest({
            name: "Setup: Create appointment (pay later)",
            method: "POST",
            url: `${baseUrl}/appointment/pay-later`,
            headers,
            body: JSON.stringify({
                doctorId,
                scheduleId: scheduleIdForPayLater,
            }),
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Create pay-later appointment failed (HTTP ${result.status}): ${result.text.slice(0, 400)}`,
            );
        }

        appointmentId = result.json?.data?.id ?? extractId(result.json);
        requireValue("appointmentId", appointmentId);
        placeholderMap["appointment-uuid"] = appointmentId;
        printResultLine(result);
    }

    // 9c) Fetch the payment transactionId for the pay-later appointment
    // (needed for /payment/ipn verification, since create/pay-later doesn't return it).
    {
        const headers = new Headers();
        headers.set("authorization", patientToken);
        const result = await httpRequest({
            name: "Setup: Fetch appointment transactionId",
            method: "GET",
            url: `${baseUrl}/appointment/my-appointment?limit=200&page=1`,
            headers,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Fetch appointment transactionId failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        const data = result.json?.data;
        const items = Array.isArray(data) ? data : data?.data;
        const arr = Array.isArray(items) ? items : [];
        const match = arr.find((a) => a && a.id === appointmentId);
        const txnId = match?.payment?.transactionId;
        requireValue("transactionId", txnId);
        vars.transactionId = txnId;
        printResultLine(result);
    }

    // 10) Initiate payment (patient)
    {
        const headers = new Headers();
        headers.set("authorization", patientToken);

        const result = await httpRequest({
            name: "Setup: Initiate payment",
            method: "POST",
            url: `${baseUrl}/appointment/${encodeURIComponent(appointmentId)}/initiate-payment`,
            headers,
        });

        // Stripe misconfig is a common local setup issue; report clearly.
        if (!result.ok) {
            printResultLine(result);
            const msg = result.json?.message ?? result.text;
            throw new Error(
                `Initiate payment failed (HTTP ${result.status}). If running locally, verify STRIPE_SECRET_KEY is set. Response: ${String(msg).slice(0, 400)}`,
            );
        }

        printResultLine(result);
    }

    const tokens = {
        admin: vars.accessToken,
        doctor: doctorToken,
        patient: patientToken,
    };

    // Avoid overriding generic URL variable keys like `id`; many requests use :id for different resources.
    vars.appointmentId = appointmentId;

    return {
        vars,
        placeholderMap,
        tokens,
        setup: {
            adminEmail,
            doctorEmail,
            patientEmail,
            specialtyIds,
            scheduleId: scheduleIds[0],
            scheduleIds,
            doctorId,
            appointmentId,
            patientId,
        },
        collectionPath,
    };
}

function flattenItems(items, prefix = "") {
    const out = [];
    for (const it of items ?? []) {
        if (it.item && Array.isArray(it.item)) {
            out.push(
                ...flattenItems(
                    it.item,
                    prefix ? `${prefix} / ${it.name}` : it.name,
                ),
            );
        } else if (it.request) {
            out.push({
                name: prefix ? `${prefix} / ${it.name}` : it.name,
                request: it.request,
            });
        }
    }
    return out;
}

function shouldSkipRequest(name, url, method) {
    const isTestMode = process.env.ENABLE_TEST_ENDPOINTS === "1";

    const openRouterKey =
        process.env.OPENROUTER_API_KEY ||
        process.env.OPENROUTERAPIKEY ||
        process.env.openrouterapikey;

    // Webhook/IPN callbacks are usually gateway-driven and not meaningful in local verification.
    if (name.includes("IPN") || name.toLowerCase().includes("webhook")) {
        return !isTestMode;
    }

    // AI endpoint depends on OpenRouter; allow skip when not configured.
    if (url.includes("/ai") || name.toLowerCase().includes("ai-powered")) {
        if (!openRouterKey) return true;
    }

    // Allow /payment/ipn verification only in test mode.
    if (url.includes("/payment/ipn")) return !isTestMode;

    // Password flows can be env-dependent and may invalidate seeded credentials.
    if (
        name.includes("Change Password") ||
        name.includes("Forgot Password") ||
        name.includes("Reset Password")
    ) {
        return !isTestMode;
    }

    // Requires paid appointment.
    if (name.includes("12. Review Module / Create Review")) return !isTestMode;

    // Avoid destructive deletes that could remove seed users; these are still covered by setup-specific deletes if desired.
    if (
        method === "DELETE" &&
        (url.includes("/user/") ||
            url.includes("/admin/") ||
            url.includes("/doctor/") ||
            url.includes("/patient/"))
    ) {
        // We'll still allow deletes if they target known placeholders (our created entities) via placeholderMap.
        return false;
    }

    return false;
}

async function runCollection({ collectionPath, vars, placeholderMap, tokens }) {
    const raw = fs.readFileSync(collectionPath, "utf8");
    const collection = JSON.parse(raw);

    const all = flattenItems(collection.item);

    const results = [];
    const unique = Date.now();
    const requestDelayMs = Number(process.env.VERIFY_DELAY_MS ?? 500);
    const isTestMode = process.env.ENABLE_TEST_ENDPOINTS === "1";

    async function createDisposableAdmin(label) {
        const fd = new FormData();
        fd.append(
            "data",
            JSON.stringify({
                password: "admin123",
                admin: {
                    name: `Temp Admin ${label}`,
                    email: `temp-admin-${label}-${Date.now()}@example.com`,
                    contactNumber: "+10000000000",
                    address: "Temp Address",
                },
            }),
        );

        const headers = new Headers();
        headers.set("authorization", tokens.admin);

        const result = await httpRequest({
            name: `Runtime: Create disposable admin (${label})`,
            method: "POST",
            url: `${vars.baseUrl}/user/create-admin`,
            headers,
            body: fd,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Disposable admin create failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        const adminId = result.json?.data?.id ?? extractId(result.json);
        if (!adminId)
            throw new Error(
                "Disposable admin create did not return an admin id",
            );
        return adminId;
    }

    async function createDisposableDoctor(label) {
        const specialtyA = placeholderMap["specialty-uuid"];
        const specialtyB = placeholderMap["specialty-uuid-2"];
        const fd = new FormData();
        fd.append(
            "data",
            JSON.stringify({
                password: "doctor123",
                doctor: {
                    name: `Dr. Temp ${label}`,
                    email: `temp-doctor-${label}-${Date.now()}@example.com`,
                    contactNumber: "+1234567890",
                    address: "123 Temp Medical Plaza",
                    registrationNumber: `TMP-REG-${label}-${Date.now()}`,
                    experience: 5,
                    gender: "MALE",
                    appointmentFee: 500,
                    qualification: "MBBS",
                    currentWorkingPlace: "Temp Hospital",
                    designation: "Doctor",
                    specialties: [specialtyA, specialtyB].filter(Boolean),
                },
            }),
        );

        const headers = new Headers();
        headers.set("authorization", tokens.admin);

        const result = await httpRequest({
            name: `Runtime: Create disposable doctor (${label})`,
            method: "POST",
            url: `${vars.baseUrl}/user/create-doctor`,
            headers,
            body: fd,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Disposable doctor create failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        const doctorId =
            result.json?.data?.id ??
            result.json?.data?.doctor?.id ??
            result.json?.data?.doctorId ??
            extractId(result.json);
        if (!doctorId)
            throw new Error(
                "Disposable doctor create did not return a doctor id",
            );
        return doctorId;
    }

    async function createDisposableSpecialty(label) {
        const fd = new FormData();
        fd.append(
            "data",
            JSON.stringify({
                title: `Temp Specialty ${label} ${Date.now()}`,
                icon: "icon-url",
            }),
        );
        const result = await httpRequest({
            name: `Runtime: Create disposable specialty (${label})`,
            method: "POST",
            url: `${vars.baseUrl}/specialties`,
            headers: new Headers(),
            body: fd,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Disposable specialty create failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }
        const id = extractId(result.json);
        if (!id)
            throw new Error("Disposable specialty create did not return an id");
        return id;
    }

    async function createDisposableSchedule(label) {
        const seed = Date.now();
        const daysAhead = 900 + (seed % 500); // 900..1399 days ahead
        const targetDate = new Date(
            Date.now() + daysAhead * 24 * 60 * 60 * 1000,
        );
        const yyyyMmDd = targetDate.toISOString().slice(0, 10);
        const headers = new Headers({ "content-type": "application/json" });
        headers.set("authorization", tokens.admin);

        const pad2 = (n) => String(n).padStart(2, "0");
        const labelSalt = Array.from(String(label)).reduce(
            (acc, ch) => acc + ch.charCodeAt(0),
            0,
        );
        const startHour = 8 + ((seed + labelSalt) % 9); // 08..16
        const startMinute = ((seed + labelSalt) % 2) * 30; // 00 or 30
        const endHour = startMinute === 30 ? startHour + 1 : startHour;
        const endMinute = startMinute === 30 ? 0 : 30;
        const startTime = `${pad2(startHour)}:${pad2(startMinute)}`;
        const endTime = `${pad2(endHour)}:${pad2(endMinute)}`;

        const createResult = await httpRequest({
            name: `Runtime: Create disposable schedule (${label})`,
            method: "POST",
            url: `${vars.baseUrl}/schedule`,
            headers,
            // Single 30-minute slot so we can grab its id directly from the response.
            body: JSON.stringify({
                startDate: yyyyMmDd,
                endDate: yyyyMmDd,
                startTime,
                endTime,
            }),
        });

        if (!createResult.ok) {
            printResultLine(createResult);
            throw new Error(
                `Disposable schedule create failed (HTTP ${createResult.status}): ${createResult.text.slice(0, 300)}`,
            );
        }

        const data = createResult.json?.data;
        const createdId = Array.isArray(data) ? data?.[0]?.id : data?.id;
        if (createdId) return createdId;

        // If no schedules were created (slot already existed), try listing for the day and pick any id.
        const listHeaders = new Headers();
        listHeaders.set("authorization", tokens.admin);
        const listResult = await httpRequest({
            name: `Runtime: Fallback list disposable schedules (${label})`,
            method: "GET",
            url: `${vars.baseUrl}/schedule?startDate=${encodeURIComponent(yyyyMmDd)}&endDate=${encodeURIComponent(yyyyMmDd)}&limit=50&page=1`,
            headers: listHeaders,
        });

        if (!listResult.ok) {
            printResultLine(listResult);
            throw new Error(
                `Disposable schedule fallback list failed (HTTP ${listResult.status}): ${listResult.text.slice(0, 300)}`,
            );
        }

        const listData = listResult.json?.data;
        const items = Array.isArray(listData) ? listData : [];
        const id = items?.[0]?.id;
        if (!id)
            throw new Error("Disposable schedule list did not return an id");
        return id;
    }

    async function createDisposablePatient(label) {
        const fd = new FormData();
        const email = `temp-patient-${label}-${Date.now()}@example.com`;
        fd.append(
            "data",
            JSON.stringify({
                password: "patient123",
                patient: {
                    name: `Temp Patient ${label}`,
                    email,
                    contactNumber: "+1234567890",
                    address: "Temp Address",
                },
            }),
        );

        const headers = new Headers();
        headers.set("authorization", tokens.admin);

        const result = await httpRequest({
            name: `Runtime: Create disposable patient (${label})`,
            method: "POST",
            url: `${vars.baseUrl}/user/create-patient`,
            headers,
            body: fd,
        });

        if (!result.ok) {
            printResultLine(result);
            throw new Error(
                `Disposable patient create failed (HTTP ${result.status}): ${result.text.slice(0, 300)}`,
            );
        }

        const patientId =
            result.json?.data?.id ??
            result.json?.data?.patient?.id ??
            result.json?.data?.patientId ??
            extractId(result.json);
        if (!patientId)
            throw new Error(
                "Disposable patient create did not return a patient id",
            );
        return patientId;
    }

    const runtimeIds = {
        adminHardDeleteId: null,
        adminSoftDeleteId: null,
        doctorUpdateId: null,
        doctorHardDeleteId: null,
        doctorSoftDeleteId: null,
        doctorScheduleDeleteId: null,
        doctorScheduleCreateIds: null,
        patientHardDeleteId: null,
    };

    for (const { name, request } of all) {
        const method = request.method ?? "GET";

        // Request-scoped placeholder overrides (avoid deleting seed/primary entities)
        const placeholderMapForRequest = { ...placeholderMap };

        if (name.includes("3. Admin Module / Delete Admin (Hard)")) {
            runtimeIds.adminHardDeleteId ??=
                await createDisposableAdmin("hard");
            placeholderMapForRequest["admin-uuid"] =
                runtimeIds.adminHardDeleteId;
        }
        if (name.includes("3. Admin Module / Delete Admin (Soft)")) {
            runtimeIds.adminSoftDeleteId ??=
                await createDisposableAdmin("soft");
            placeholderMapForRequest["admin-uuid"] =
                runtimeIds.adminSoftDeleteId;
        }

        if (name.includes("4. Doctor Module / Update Doctor")) {
            runtimeIds.doctorUpdateId ??=
                await createDisposableDoctor("update");
            placeholderMapForRequest["doctor-uuid"] = runtimeIds.doctorUpdateId;
        }
        if (name.includes("4. Doctor Module / Delete Doctor (Hard)")) {
            runtimeIds.doctorHardDeleteId ??=
                await createDisposableDoctor("hard");
            placeholderMapForRequest["doctor-uuid"] =
                runtimeIds.doctorHardDeleteId;
        }
        if (name.includes("4. Doctor Module / Delete Doctor (Soft)")) {
            runtimeIds.doctorSoftDeleteId ??=
                await createDisposableDoctor("soft");
            placeholderMapForRequest["doctor-uuid"] =
                runtimeIds.doctorSoftDeleteId;
        }

        if (name.includes("6. Specialties Module / Delete Specialty")) {
            const specialtyId = await createDisposableSpecialty("delete");
            placeholderMapForRequest["specialty-uuid"] = specialtyId;
        }

        if (name.includes("7. Schedule Module / Delete Schedule")) {
            const scheduleId = await createDisposableSchedule("delete");
            placeholderMapForRequest["schedule-uuid"] = scheduleId;
        }

        if (name.includes("5. Patient Module / Delete Patient (Hard)")) {
            runtimeIds.patientHardDeleteId ??=
                await createDisposablePatient("hard-delete");
            placeholderMapForRequest["patient-uuid"] =
                runtimeIds.patientHardDeleteId;
        }

        if (
            name.includes("8. Doctor Schedule Module / Create Doctor Schedule")
        ) {
            const s1 = await createDisposableSchedule("doc-schedule-1");
            const s2 = await createDisposableSchedule("doc-schedule-2");
            runtimeIds.doctorScheduleCreateIds = [s1, s2];
            runtimeIds.doctorScheduleDeleteId = s1;
            placeholderMapForRequest["schedule-uuid-1"] = s1;
            placeholderMapForRequest["schedule-uuid-2"] = s2;
        }

        if (
            name.includes("8. Doctor Schedule Module / Delete Doctor Schedule")
        ) {
            if (runtimeIds.doctorScheduleDeleteId) {
                placeholderMapForRequest["schedule-uuid"] =
                    runtimeIds.doctorScheduleDeleteId;
            }
        }

        // Compose URL
        let url;
        try {
            url = resolveUrl(request.url, vars, placeholderMapForRequest);
        } catch (e) {
            results.push({
                name,
                status: 0,
                ok: false,
                skipped: true,
                reason: String(e?.message ?? e),
            });
            console.log(
                `[SKIP] ${name} (url build: ${String(e?.message ?? e)})`,
            );
            continue;
        }

        if (shouldSkipRequest(name, url, method)) {
            results.push({
                name,
                status: 0,
                ok: true,
                skipped: true,
                reason: "Skipped by rule (requires external callback/config)",
            });
            console.log(`[SKIP] ${name}`);
            continue;
        }

        const headers = mergeHeaders(request.header);

        // Auth
        let token = pickRoleToken(url, method, tokens);

        // Make password-change verification safe/deterministic:
        // run it as the setup patient (not admin) and use the correct oldPassword.
        if (isTestMode && name.includes("1. Auth Module / Change Password")) {
            token = tokens.patient;
        }
        if (token) headers.set("authorization", token);

        // Body
        let body;
        const bodyDef = request.body;
        if (bodyDef?.mode === "raw") {
            const rawBody = substitute(
                bodyDef.raw ?? "",
                vars,
                placeholderMapForRequest,
            );

            if (
                isTestMode &&
                name.includes("1. Auth Module / Change Password")
            ) {
                try {
                    const parsed = JSON.parse(rawBody);
                    parsed.oldPassword = vars.patientPassword;
                    parsed.newPassword = `patientNew${unique}`;
                    body = JSON.stringify(parsed);
                } catch {
                    body = rawBody;
                }
            }

            if (
                isTestMode &&
                name.includes("1. Auth Module / Forgot Password")
            ) {
                try {
                    const parsed = JSON.parse(rawBody);
                    parsed.email = vars.resetFlowEmail;
                    body = JSON.stringify(parsed);
                } catch {
                    body = rawBody;
                }
            }

            if (
                isTestMode &&
                name.includes("1. Auth Module / Reset Password")
            ) {
                try {
                    const parsed = JSON.parse(rawBody);
                    parsed.token = vars.resetToken || parsed.token;
                    parsed.newPassword = `resetNew${unique}`;
                    // Some implementations require email to match token; include it when available.
                    parsed.email = parsed.email || vars.resetFlowEmail;
                    body = JSON.stringify(parsed);
                } catch {
                    body = rawBody;
                }
            }

            if (
                name.includes("11. Prescription Module / Create Prescription")
            ) {
                try {
                    const parsed = JSON.parse(rawBody);
                    if (
                        parsed?.followUpDate &&
                        typeof parsed.followUpDate === "string" &&
                        !parsed.followUpDate.includes("T")
                    ) {
                        parsed.followUpDate = new Date(
                            parsed.followUpDate,
                        ).toISOString();
                    }
                    body = JSON.stringify(parsed);
                } catch {
                    body = rawBody;
                }
            }
            if (
                name.includes("Create Admin") ||
                name.includes("Create Doctor") ||
                name.includes("Create Patient")
            ) {
                try {
                    const parsed = JSON.parse(rawBody);
                    if (parsed?.admin?.email)
                        parsed.admin.email = `admin${unique}@example.com`;
                    if (parsed?.doctor?.email)
                        parsed.doctor.email = `doctor${unique}@example.com`;
                    if (parsed?.doctor?.registrationNumber)
                        parsed.doctor.registrationNumber = `REG-${unique}`;
                    if (parsed?.patient?.email)
                        parsed.patient.email = `patient${unique}@example.com`;
                    body = JSON.stringify(parsed);
                } catch {
                    body = rawBody;
                }
            } else if (!body) {
                body = rawBody;
            }
            if (!headers.has("content-type"))
                headers.set("content-type", "application/json");
        } else if (bodyDef?.mode === "formdata") {
            const fd = new FormData();
            for (const f of bodyDef.formdata ?? []) {
                if (!f?.key) continue;
                if (f.type === "file") {
                    // Collection uses empty file placeholders; omit.
                    continue;
                }
                let value = substitute(
                    f.value ?? "",
                    vars,
                    placeholderMapForRequest,
                );

                if (
                    f.key === "data" &&
                    (name.includes("Create Admin") ||
                        name.includes("Create Doctor") ||
                        name.includes("Create Patient"))
                ) {
                    try {
                        const parsed = JSON.parse(value);
                        if (parsed?.admin?.email)
                            parsed.admin.email = `admin${unique}@example.com`;
                        if (parsed?.doctor?.email)
                            parsed.doctor.email = `doctor${unique}@example.com`;
                        if (parsed?.doctor?.registrationNumber)
                            parsed.doctor.registrationNumber = `REG-${unique}`;
                        if (parsed?.patient?.email)
                            parsed.patient.email = `patient${unique}@example.com`;
                        value = JSON.stringify(parsed);
                    } catch {
                        // ignore
                    }
                }

                fd.append(f.key, value);
            }
            body = fd;
            // Let fetch set content-type boundary.
            headers.delete("content-type");
        }

        const result = await httpRequest({ name, method, url, headers, body });

        // Capture reset token from test-mode forgot-password so reset-password can use it.
        if (isTestMode && name.includes("1. Auth Module / Forgot Password")) {
            const tokenFromResponse = result.json?.data?.resetToken;
            if (typeof tokenFromResponse === "string" && tokenFromResponse) {
                vars.resetToken = tokenFromResponse;
            }
        }

        // Consider 2xx/3xx passes. Many endpoints return 200.
        const ok = result.status >= 200 && result.status < 400;
        const final = { ...result, ok };
        printResultLine(final);
        results.push({ name, status: result.status, ok });

        // Keep tokens in sync if a response sets them as cookies.
        const accessToken = getCookieValue(result.setCookies, "accessToken");
        const refreshToken = getCookieValue(result.setCookies, "refreshToken");
        if (typeof accessToken === "string" && accessToken.length > 0)
            vars.accessToken = accessToken;
        if (typeof refreshToken === "string" && refreshToken.length > 0)
            vars.refreshToken = refreshToken;

        if (requestDelayMs > 0) await sleep(requestDelayMs);
    }

    const passCount = results.filter((r) => r.ok && !r.skipped).length;
    const failCount = results.filter((r) => !r.ok && !r.skipped).length;
    const skipCount = results.filter((r) => r.skipped).length;

    console.log("");
    console.log(`Summary @ ${nowIso()}`);
    console.log(`- PASS: ${passCount}`);
    console.log(`- FAIL: ${failCount}`);
    console.log(`- SKIP: ${skipCount}`);

    const strict = process.env.VERIFY_STRICT === "1";
    if (failCount > 0 || (strict && skipCount > 0)) {
        process.exitCode = 1;
    }
}

async function main() {
    const baseUrl = process.env.BASE_URL ?? "http://localhost:5000/api/v1";
    const collectionPath =
        process.env.POSTMAN_COLLECTION ?? DEFAULT_COLLECTION_PATH;

    console.log(`API Verify starting @ ${nowIso()}`);
    console.log(`- BASE_URL: ${baseUrl}`);
    console.log(`- Collection: ${collectionPath}`);

    const setup = await runSetupFlow({ baseUrl, collectionPath });

    console.log("");
    console.log("Setup complete. Running Postman collection requests...");
    console.log("");

    await runCollection(setup);
}

main().catch((err) => {
    console.error("API Verify FAILED");
    console.error(err);
    process.exitCode = 1;
});
