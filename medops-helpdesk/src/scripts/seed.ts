import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Category } from "../models/Category";
import { Ticket } from "../models/Ticket";
import { Message } from "../models/Message";
import { ActivityLog } from "../models/ActivityLog";
import { calculateSLADates, TicketPriority, TicketStatus } from "../lib/sla";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI is missing in .env.local");
    process.exit(1);
}

async function seed() {
    try {
        console.log("⏳ Connecting to MongoDB Atlas...");
        await mongoose.connect(MONGODB_URI!);
        console.log("✅ Connected! Clearing existing MedOps data...");

        await Promise.all([
            User.deleteMany({}),
            Category.deleteMany({}),
            Ticket.deleteMany({}),
            Message.deleteMany({}),
            ActivityLog.deleteMany({}),
        ]);

        const hashedPassword = await bcrypt.hash("Password123!", 10);

        // 1. Create 1 Admin, 2 Agents, 3 Users (Clinicians/Staff)
        console.log("👤 Creating Users (1 Admin, 2 Agents, 3 Clinic Users)...");
        const [admin, agent1, agent2, user1, user2, user3] = await User.create([
            {
                name: "Marcus Vance (IT Director)",
                email: "admin@medops.com",
                password: hashedPassword,
                role: "admin",
                facility: "MedOps HQ - Boston, MA",
                isActive: true,
            },
            {
                name: "Elena Rostova (Sr. Clinical Systems Engineer)",
                email: "elena.agent@medops.com",
                password: hashedPassword,
                role: "agent",
                facility: "NOC Tier-2 Support",
                isActive: true,
            },
            {
                name: "Devon Brooks (IT Support Specialist)",
                email: "devon.agent@medops.com",
                password: hashedPassword,
                role: "agent",
                facility: "NOC Tier-1 Helpdesk",
                isActive: true,
            },
            {
                name: "Dr. Sarah Jenkins",
                email: "sarah.jenkins@stjudeclinic.org",
                password: hashedPassword,
                role: "user",
                facility: "St. Jude Outpatient Clinic - ER",
                isActive: true,
            },
            {
                name: "Nurse Rachel Adams",
                email: "rachel.adams@metrohealth.org",
                password: hashedPassword,
                role: "user",
                facility: "MetroHealth Pediatrics Wing",
                isActive: true,
            },
            {
                name: "Liam O'Connor (Lab Coordinator)",
                email: "liam.oconnor@bayviewdiagnostics.org",
                password: hashedPassword,
                role: "user",
                facility: "Bayview Diagnostics Lab",
                isActive: true,
            },
        ]);

        // 2. Create 4 Healthcare IT Categories
        console.log("📂 Creating 4 Healthcare IT Categories...");
        const [catEHR, catLab, catAccess, catTelehealth] = await Category.create([
            {
                name: "EHR & Clinical Software",
                description:
                    "Epic/Cerner charting errors, e-Prescribing timeouts, and HL7 patient sync issues.",
                defaultPriority: "Urgent",
            },
            {
                name: "Lab & Diagnostic Hardware",
                description:
                    "Barcode wrist-band scanners, DICOM radiology viewers, and lab label printers.",
                defaultPriority: "High",
            },
            {
                name: "Identity & HIPAA Access",
                description:
                    "SSO badge tap login, MFA token resets, and role-based EHR permissions.",
                defaultPriority: "Medium",
            },
            {
                name: "Telehealth & Network",
                description:
                    "Clinic Wi-Fi dead zones, VoIP nurse station phones, and video consult room gear.",
                defaultPriority: "Low",
            },
        ]);

        // 3. Create 16 Realistic Tickets across various states & SLA timelines
        console.log("🎫 Creating 16 Realistic Clinical Support Tickets...");
        const now = new Date();
        const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

        const sampleTicketsData: Array<{
            title: string;
            description: string;
            category: mongoose.Types.ObjectId;
            priority: TicketPriority;
            status: TicketStatus;
            createdBy: mongoose.Types.ObjectId;
            assignedAgent: mongoose.Types.ObjectId | null;
            createdHoursAgo: number;
            firstResponseMinutesAfter?: number;
            resolvedHoursAfter?: number;
            forceBreach?: boolean;
        }> = [
                {
                    title: "Epic EHR e-Prescribe gateway returning HTTP 504 in Triage Room 4",
                    description:
                        "Physicians cannot transmit controlled substance prescriptions to Walgreens/CVS via SureScripts. Receiving gateway timeout after 15 seconds.",
                    category: catEHR._id,
                    priority: "Urgent",
                    status: "In Progress",
                    createdBy: user1._id,
                    assignedAgent: agent1._id,
                    createdHoursAgo: 3,
                    firstResponseMinutesAfter: 22,
                },
                {
                    title: "Zebra ZD420 specimen label printer jamming in Hematology Lab",
                    description:
                        "Blood draw barcode labels are printing half-cut and failing optical scan at the centrifuge station. Urgent morning batch affected.",
                    category: catLab._id,
                    priority: "High",
                    status: "Open",
                    createdBy: user3._id,
                    assignedAgent: agent2._id,
                    createdHoursAgo: 6, // High response SLA is 4h -> Breached!
                    forceBreach: true,
                },
                {
                    title: "Imprivata SSO proximity badge reader not detecting tap at Nurse Station B",
                    description:
                        "Nurses have to manually type 14-character domain passwords every time they switch charting terminals.",
                    category: catAccess._id,
                    priority: "Medium",
                    status: "Waiting on User",
                    createdBy: user2._id,
                    assignedAgent: agent2._id,
                    createdHoursAgo: 18,
                    firstResponseMinutesAfter: 95,
                },
                {
                    title: "HL7 lab results feed delayed by 45+ minutes from Quest Diagnostics",
                    description:
                        "STAT CBC and metabolic panels completed in lab are not populating into patient charts automatically.",
                    category: catEHR._id,
                    priority: "Urgent",
                    status: "Open",
                    createdBy: user3._id,
                    assignedAgent: agent1._id,
                    createdHoursAgo: 2, // Urgent response SLA is 1h -> Breached!
                    forceBreach: true,
                },
                {
                    title: "New Locum Tenens Pediatrician needs Epic production credentials",
                    description:
                        "Dr. K. Patel starts morning rounds tomorrow at 7:00 AM. Background check and DEA verification attached.",
                    category: catAccess._id,
                    priority: "High",
                    status: "Resolved",
                    createdBy: user2._id,
                    assignedAgent: agent2._id,
                    createdHoursAgo: 30,
                    firstResponseMinutesAfter: 40,
                    resolvedHoursAfter: 5,
                },
                {
                    title: "Telehealth cart camera failing autofocus in Consult Room 204",
                    description:
                        "Dermatology remote consults are blurry. USB PTZ camera rebooted twice without improvement.",
                    category: catTelehealth._id,
                    priority: "Low",
                    status: "Open",
                    createdBy: user1._id,
                    assignedAgent: null, // Unassigned ticket for Admin to test assignment!
                    createdHoursAgo: 5,
                },
                {
                    title: "PACS Radiology viewer freezing when loading 3D Chest CT series",
                    description:
                        "Workstation #3 runs out of memory when opening studies larger than 800 slices.",
                    category: catLab._id,
                    priority: "High",
                    status: "In Progress",
                    createdBy: user3._id,
                    assignedAgent: agent1._id,
                    createdHoursAgo: 10,
                    firstResponseMinutesAfter: 55,
                },
                {
                    title: "MFA Duo Push notifications not arriving on new iOS 19 clinic iPads",
                    description:
                        "Three triage iPads cannot complete two-factor authentication during morning shift handoff.",
                    category: catAccess._id,
                    priority: "Medium",
                    status: "Resolved",
                    createdBy: user1._id,
                    assignedAgent: agent2._id,
                    createdHoursAgo: 96, // Resolved > 3 days ago (great for testing 3-day Auto-Close!)
                    firstResponseMinutesAfter: 110,
                    resolvedHoursAfter: 12,
                },
                {
                    title: "Pharmacy Pyxis MedStation cabinet drawer #3 stuck locked",
                    description:
                        "Emergency override works, but automated dispense command from EHR fails with hardware bus error.",
                    category: catLab._id,
                    priority: "Urgent",
                    status: "Resolved",
                    createdBy: user2._id,
                    assignedAgent: agent1._id,
                    createdHoursAgo: 40,
                    firstResponseMinutesAfter: 15,
                    resolvedHoursAfter: 4,
                },
                {
                    title: "Wi-Fi dead zone in Basement Medical Records Archive",
                    description:
                        "Mobile inventory scanners lose connection when staff walk past aisle 6.",
                    category: catTelehealth._id,
                    priority: "Low",
                    status: "Closed",
                    createdBy: user3._id,
                    assignedAgent: agent2._id,
                    createdHoursAgo: 140,
                    firstResponseMinutesAfter: 180,
                    resolvedHoursAfter: 36,
                },
                {
                    title: "Patient Discharge Summary PDF printing blank medication tables",
                    description:
                        "After Tuesday night's patch, discharge instructions omit active prescriptions on page 2.",
                    category: catEHR._id,
                    priority: "High",
                    status: "In Progress",
                    createdBy: user1._id,
                    assignedAgent: agent1._id,
                    createdHoursAgo: 8,
                    firstResponseMinutesAfter: 35,
                },
                {
                    title: "Cisco VoIP phone at ER Reception Desk showing 'SIP Registration Failed'",
                    description:
                        "Inbound patient triage line #2 is not ringing on the front desk handset.",
                    category: catTelehealth._id,
                    priority: "Medium",
                    status: "Open",
                    createdBy: user1._id,
                    assignedAgent: null, // Unassigned
                    createdHoursAgo: 4,
                },
                {
                    title: "Locked out of Billing & Claims Clearinghouse portal after 3 retries",
                    description:
                        "Need account unlock and password reset for Waystar insurance verification portal.",
                    category: catAccess._id,
                    priority: "Low",
                    status: "Closed",
                    createdBy: user2._id,
                    assignedAgent: agent2._id,
                    createdHoursAgo: 120,
                    firstResponseMinutesAfter: 60,
                    resolvedHoursAfter: 3,
                },
                {
                    title: "Welch Allyn Vital Signs monitor not auto-posting BP to patient chart",
                    description:
                        "Bluetooth pairing shows connected, but vitals fail to cross over to Epic flowsheet.",
                    category: catLab._id,
                    priority: "Medium",
                    status: "Waiting on User",
                    createdBy: user2._id,
                    assignedAgent: agent1._id,
                    createdHoursAgo: 22,
                    firstResponseMinutesAfter: 75,
                },
                {
                    title: "ICD-10 coding lookup search returning slow results in Outpatient module",
                    description:
                        "Search dropdown takes 8-10 seconds to populate diagnosis codes during patient checkout.",
                    category: catEHR._id,
                    priority: "Medium",
                    status: "Open",
                    createdBy: user1._id,
                    assignedAgent: agent1._id,
                    createdHoursAgo: 12, // Medium response is 8h -> Breached!
                    forceBreach: true,
                },
                {
                    title: "Requesting VPN split-tunnel access for on-call Radiologist laptop",
                    description:
                        "Dr. Miller needs home PACS access configured on clinic-issued MacBook Pro before weekend call.",
                    category: catTelehealth._id,
                    priority: "Low",
                    status: "In Progress",
                    createdBy: user3._id,
                    assignedAgent: agent2._id,
                    createdHoursAgo: 16,
                    firstResponseMinutesAfter: 120,
                },
            ];

        for (let i = 0; i < sampleTicketsData.length; i++) {
            const item = sampleTicketsData[i];
            const ticketNumber = `TKT-${String(i + 1).padStart(4, "0")}`;
            const createdAt = hoursAgo(item.createdHoursAgo);
            const { responseDueDate, resolutionDueDate } = calculateSLADates(
                item.priority,
                createdAt
            );

            const firstRespondedAt = item.firstResponseMinutesAfter
                ? new Date(
                    createdAt.getTime() + item.firstResponseMinutesAfter * 60 * 1000
                )
                : null;

            const resolvedAt = item.resolvedHoursAfter
                ? new Date(
                    createdAt.getTime() + item.resolvedHoursAfter * 60 * 60 * 1000
                )
                : null;

            const closedAt =
                item.status === "Closed" && resolvedAt
                    ? new Date(resolvedAt.getTime() + 24 * 60 * 60 * 1000)
                    : null;

            const ticket = await Ticket.create({
                ticketNumber,
                title: item.title,
                description: item.description,
                category: item.category,
                priority: item.priority,
                status: item.status,
                createdBy: item.createdBy,
                assignedAgent: item.assignedAgent,
                attachments: [],
                responseDueDate,
                resolutionDueDate,
                firstRespondedAt,
                resolvedAt,
                closedAt,
                slaBreached: Boolean(item.forceBreach),
                createdAt,
                updatedAt: resolvedAt || firstRespondedAt || createdAt,
            });

            // Activity Log: Ticket Created
            await ActivityLog.create({
                ticket: ticket._id,
                actor: item.createdBy,
                action: "TICKET_CREATED",
                details: `Created ticket ${ticketNumber} with ${item.priority} priority`,
                createdAt,
            });

            // Agar agent assigned hai toh assignment log aur conversation messages banayein
            if (item.assignedAgent) {
                await ActivityLog.create({
                    ticket: ticket._id,
                    actor: admin._id,
                    action: "ASSIGNED",
                    details: `Assigned ticket to support engineer`,
                    createdAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
                });
            }

            if (firstRespondedAt && item.assignedAgent) {
                // Public Agent Reply
                await Message.create({
                    ticket: ticket._id,
                    author: item.assignedAgent,
                    body: "We have received your incident report and are actively checking the clinical server logs. Will update you shortly.",
                    isInternal: false,
                    attachments: [],
                    createdAt: firstRespondedAt,
                });

                // Internal Note (Staff Only) - taake examiner ko Internal Note feature foran dikhe!
                await Message.create({
                    ticket: ticket._id,
                    author: item.assignedAgent,
                    body: "INTERNAL NOC NOTE: Checked HL7 interface engine and edge router logs. Escalating to tier-2 patch queue if latency persists.",
                    isInternal: true,
                    attachments: [],
                    createdAt: new Date(firstRespondedAt.getTime() + 10 * 60 * 1000),
                });
            }
        }

        console.log("\n🎉 MedOps Database Seeded Successfully!");
        console.log("--------------------------------------------------");
        console.log("🔑 Test Credentials (Password for all: Password123!)");
        console.log("   Admin : admin@medops.com");
        console.log("   Agent1: elena.agent@medops.com");
        console.log("   Agent2: devon.agent@medops.com");
        console.log("   User1 : sarah.jenkins@stjudeclinic.org");
        console.log("   User2 : rachel.adams@metrohealth.org");
        console.log("   User3 : liam.oconnor@bayviewdiagnostics.org");
        console.log("--------------------------------------------------");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seed failed:", error);
        process.exit(1);
    }
}

seed();