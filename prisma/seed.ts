import type { Payment, Property, Tenant, Unit } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const DEMO_PASSWORD = "PropManager-Demo-2026!";
const now = new Date("2026-08-06T12:00:00.000Z");
const date = (value: string) => new Date(`${value}T12:00:00.000Z`);

async function main() {
	console.log("Seeding deterministic production demo data...");

	const [primary, edge] = await Promise.all([
		db.organization.upsert({
			where: { id: "org_default" },
			update: {
				name: "PropManager Demo",
				nameAr: "عرض مدير العقارات",
				slug: "propmanager-demo",
				currency: "AED",
				locale: "en",
				timezone: "Asia/Dubai",
			},
			create: {
				id: "org_default",
				name: "PropManager Demo",
				nameAr: "عرض مدير العقارات",
				slug: "propmanager-demo",
				currency: "AED",
				locale: "en",
				timezone: "Asia/Dubai",
			},
		}),
		db.organization.create({
			data: {
				id: "org_edge",
				name: "Boundary Estates",
				nameAr: "عقارات الحدود",
				slug: "boundary-estates",
				currency: "USD",
				locale: "ar",
				timezone: "UTC",
			},
		}),
	]);

	const passwordHash = await hashPassword(DEMO_PASSWORD);
	const accounts = [
		["owner@propmanager.demo", "Demo Owner", "owner", true],
		["manager@propmanager.demo", "Maya Manager", "manager", true],
		["accountant@propmanager.demo", "Amina Accountant", "accountant", true],
		["maintenance@propmanager.demo", "Malik Maintenance", "maintenance", true],
		["viewer@propmanager.demo", "Vera Viewer", "viewer", true],
		["inactive@propmanager.demo", "Inactive User", "viewer", false],
	] as const;

	for (const [email, name, role, active] of accounts) {
		const user = await db.user.create({
			data: { email, name, passwordHash, isActive: active },
		});
		await db.membership.create({
			data: {
				userId: user.id,
				organizationId: primary.id,
				role,
				isActive: active,
			},
		});
		if (role === "owner") {
			await db.membership.create({
				data: { userId: user.id, organizationId: edge.id, role: "owner" },
			});
		}
	}

	const propertySpecs = [
		[
			"Sunset Towers",
			"أبراج الغروب",
			"123 Sunset Boulevard",
			"Dubai",
			"residential",
			4,
			"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
		],
		[
			"Marina Heights",
			"مرينا هايتس",
			"456 Marina Walk",
			"Dubai",
			"mixed",
			3,
			"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
		],
		[
			"Business Bay Plaza",
			"بلازا الخليج التجاري",
			"789 Business Bay",
			"Dubai",
			"commercial",
			2,
			"https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80",
		],
		[
			"Empty Lot – Phase Ω",
			"أرض فارغة",
			"0 Edge Case Road",
			"Abu Dhabi",
			"residential",
			0,
			null,
		],
	] as const;

	const properties: Property[] = [];
	for (let index = 0; index < propertySpecs.length; index++) {
		const [name, nameAr, address, city, type, totalUnits, image] =
			propertySpecs[index];
		properties.push(
			await db.property.create({
				data: {
					organizationId: primary.id,
					name,
					nameAr,
					address,
					addressAr: `${index + 1} شارع تجريبي`,
					city,
					cityAr: city === "Dubai" ? "دبي" : "أبو ظبي",
					state: index === 3 ? null : city,
					zipCode: index === 3 ? "" : `0000${index + 1}`,
					description:
						index === 3
							? ""
							: `${type} property used for production demo workflows`,
					descriptionAr: index === 3 ? null : "عقار تجريبي لاختبار سير العمل",
					type,
					totalUnits,
					image,
					manager: totalUnits
						? {
								create: {
									organizationId: primary.id,
									name: [
										"Ahmed Al-Rashid",
										"Sara Al-Maktoum",
										"Mohammed Al-Fahim",
									][index],
									nameAr: ["أحمد الراشد", "سارة المكتوم", "محمد الفهيم"][index],
									email: `manager${index + 1}@propmanager.demo`,
									phone: index === 2 ? null : `+971-50-000-000${index + 1}`,
								},
							}
						: undefined,
				},
			}),
		);
	}

	const unitSpecs = [
		[0, "101", 1, 1, 1, 55, "available", "3200.00"],
		[0, "102", 1, 2, 1.5, 80, "rented", "4800.00"],
		[0, "PH-∞", 40, 5, 4, 500, "maintenance", "999999.99"],
		[0, "B-01", -1, 0, 1, null, "available", "0.00"],
		[1, "201", 2, 2, 2, 95, "rented", "6200.00"],
		[1, "SHOP-A", 0, 0, 1, 140, "available", "15000.00"],
		[1, "203", 2, 3, 2, 125, "maintenance", "8500.00"],
		[2, "OFF-1", 10, 0, 2, 220, "rented", "18000.00"],
		[2, "OFF-2", 11, 0, 2, 220, "available", "18000.00"],
	] as const;

	const units: Unit[] = [];
	for (const [
		propertyIndex,
		unitNumber,
		floor,
		rooms,
		bathrooms,
		area,
		status,
		rentAmount,
	] of unitSpecs) {
		units.push(
			await db.unit.create({
				data: {
					organizationId: primary.id,
					propertyId: properties[propertyIndex].id,
					unitNumber,
					floor,
					rooms,
					bathrooms,
					area,
					status,
					rentAmount,
				},
			}),
		);
	}

	const tenantSpecs = [
		["Omar Hassan", "عمر حسن", "omar@tenant.demo", "active"],
		["Layla Mahmoud", "ليلى محمود", "layla@tenant.demo", "active"],
		["David Chen", "ديفيد تشن", "david@tenant.demo", "active"],
		["Nour Al-Din", "نور الدين", "nour+unicode@tenant.demo", "active"],
		["Former Tenant", "مستأجر سابق", "former@tenant.demo", "inactive"],
	] as const;
	const tenants: Tenant[] = [];
	for (let index = 0; index < tenantSpecs.length; index++) {
		const [name, nameAr, email, status] = tenantSpecs[index];
		tenants.push(
			await db.tenant.create({
				data: {
					organizationId: primary.id,
					name,
					nameAr,
					email,
					phone: index === 4 ? null : `+971-55-100-000${index}`,
					nationalId: index === 3 ? "UAE-EDGE-Ω" : `UAE-000${index + 1}`,
					emergencyContact: index === 4 ? "" : `+971-55-200-000${index}`,
					status,
				},
			}),
		);
	}

	const leases = [
		await db.lease.create({
			data: {
				organizationId: primary.id,
				unitId: units[1].id,
				tenantId: tenants[0].id,
				startDate: date("2026-01-01"),
				endDate: date("2026-12-31"),
				rentAmount: "4800.00",
				deposit: "9600.00",
				status: "active",
			},
		}),
		await db.lease.create({
			data: {
				organizationId: primary.id,
				unitId: units[4].id,
				tenantId: tenants[1].id,
				startDate: date("2025-09-01"),
				endDate: date("2026-08-31"),
				rentAmount: "6200.00",
				deposit: "0.00",
				status: "active",
			},
		}),
		await db.lease.create({
			data: {
				organizationId: primary.id,
				unitId: units[7].id,
				tenantId: tenants[2].id,
				startDate: date("2026-06-01"),
				endDate: date("2027-05-31"),
				rentAmount: "18000.00",
				deposit: null,
				status: "active",
			},
		}),
		await db.lease.create({
			data: {
				organizationId: primary.id,
				unitId: units[0].id,
				tenantId: tenants[4].id,
				startDate: date("2024-01-01"),
				endDate: date("2024-12-31"),
				rentAmount: "3000.00",
				deposit: "6000.00",
				status: "expired",
			},
		}),
		await db.lease.create({
			data: {
				organizationId: primary.id,
				unitId: units[2].id,
				tenantId: tenants[3].id,
				startDate: date("2025-01-01"),
				endDate: date("2025-07-31"),
				rentAmount: "12000.00",
				deposit: "24000.00",
				status: "terminated",
			},
		}),
	];

	const paymentSpecs = [
		["paid", "4800.00", "2026-01-01", "2026-01-01", "online", "PAY-PAID"],
		["pending", "4800.00", "2026-09-01", null, null, null],
		["late", "6200.00", "2026-07-01", null, null, null],
		[
			"partial",
			"3100.00",
			"2026-08-01",
			"2026-08-03",
			"bank_transfer",
			"PAY-PARTIAL",
		],
		["voided", "18000.00", "2026-10-01", null, null, null],
		[
			"partially_refunded",
			"18000.00",
			"2026-06-01",
			"2026-06-01",
			"check",
			"PAY-PARTIAL-REFUND",
		],
		[
			"refunded",
			"4800.00",
			"2026-02-01",
			"2026-02-01",
			"cash",
			"PAY-FULL-REFUND",
		],
	] as const;
	const payments: Payment[] = [];
	for (let index = 0; index < paymentSpecs.length; index++) {
		const [status, amount, dueDate, paidDate, method, reference] =
			paymentSpecs[index];
		const lease = leases[index % 3];
		payments.push(
			await db.payment.create({
				data: {
					organizationId: primary.id,
					leaseId: lease.id,
					tenantId: lease.tenantId,
					amount,
					dueDate: date(dueDate),
					paidDate: paidDate ? date(paidDate) : null,
					status,
					method,
					reference,
					notes: index === 1 ? "Intentionally pending boundary case" : null,
				},
			}),
		);
	}
	await db.paymentAdjustment.createMany({
		data: [
			{
				organizationId: primary.id,
				paymentId: payments[4].id,
				type: "void",
				amount: "0.00",
				reason: "Duplicate invoice created during demo",
				createdByUserId: null,
			},
			{
				organizationId: primary.id,
				paymentId: payments[5].id,
				type: "refund",
				amount: "1000.00",
				reason: "Partial service credit",
				createdByUserId: null,
			},
			{
				organizationId: primary.id,
				paymentId: payments[6].id,
				type: "refund",
				amount: "4800.00",
				reason: "Lease cancelled before occupancy",
				createdByUserId: null,
			},
		],
	});

	const priorities = ["low", "medium", "high", "urgent", "medium", "high"];
	const statuses = [
		"open",
		"in_progress",
		"resolved",
		"closed",
		"open",
		"resolved",
	];
	const categories = [
		"plumbing",
		"electrical",
		"structural",
		"appliance",
		"hvac",
		"other",
	];
	for (let index = 0; index < categories.length; index++) {
		const status = statuses[index];
		await db.maintenanceRequest.create({
			data: {
				organizationId: primary.id,
				propertyId: index === 4 ? properties[1].id : units[index].propertyId,
				unitId: index === 4 ? null : units[index].id,
				tenantId: index === 5 ? null : tenants[index % 4].id,
				title: [
					"Leaking faucet",
					"Power outage",
					"Wall crack",
					"Broken dishwasher",
					"HVAC inspection",
					"Other: emoji 🚪",
				][index],
				titleAr: [
					"حنفية تتسرب",
					"انقطاع الكهرباء",
					"تشقّق الجدار",
					"غسالة صحون معطلة",
					"فحص التكييف",
					"أخرى",
				][index],
				description:
					index === 5
						? "No unit or tenant assigned."
						: "Deterministic maintenance workflow example.",
				descriptionAr: "مثال ثابت لسير عمل الصيانة.",
				priority: priorities[index],
				status,
				category: categories[index],
				assignedTo: status === "open" ? null : "Maintenance Team A",
				completedAt: ["resolved", "closed"].includes(status) ? now : null,
			},
		});
	}

	const messageCategories = [
		"general",
		"maintenance",
		"payment",
		"lease",
		"other",
	];
	for (let index = 0; index < messageCategories.length; index++) {
		await db.message.create({
			data: {
				organizationId: primary.id,
				senderName: tenants[index].name,
				senderEmail: tenants[index].email,
				subject:
					index === 4
						? "Boundary: <script> is text"
						: `${messageCategories[index]} question`,
				content:
					index === 4
						? "Unicode and HTML-like input: <b>safe text</b> مرحبا"
						: `Demo ${messageCategories[index]} message`,
				isRead: index % 2 === 0,
				category: messageCategories[index],
			},
		});
	}

	await db.activityLog.createMany({
		data: [
			{
				organizationId: primary.id,
				action: "created",
				entity: "property",
				entityId: properties[0].id,
				details: "Seeded Sunset Towers",
			},
			{
				organizationId: primary.id,
				action: "payment",
				entity: "payment",
				entityId: payments[0].id,
				details: "Payment received",
			},
			{
				organizationId: primary.id,
				action: "resolved",
				entity: "maintenance",
				details: "Maintenance request resolved",
			},
			{
				organizationId: primary.id,
				action: "updated",
				entity: "tenant",
				entityId: tenants[3].id,
				details: null,
			},
		],
	});

	const edgeProperty = await db.property.create({
		data: {
			organizationId: edge.id,
			name: "Isolated Property",
			nameAr: "عقار معزول",
			address: "999 Isolation Lane",
			city: "Doha",
			type: "residential",
			totalUnits: 1,
		},
	});
	const edgeUnit = await db.unit.create({
		data: {
			organizationId: edge.id,
			propertyId: edgeProperty.id,
			unitNumber: "ISO-1",
			floor: 1,
			rooms: 1,
			bathrooms: 1,
			area: 40,
			rentAmount: "1000.00",
			status: "rented",
		},
	});
	const edgeTenant = await db.tenant.create({
		data: {
			organizationId: edge.id,
			name: "Isolated Tenant",
			email: "isolated@tenant.demo",
			status: "active",
		},
	});
	const edgeLease = await db.lease.create({
		data: {
			organizationId: edge.id,
			unitId: edgeUnit.id,
			tenantId: edgeTenant.id,
			startDate: date("2026-01-01"),
			endDate: date("2026-12-31"),
			rentAmount: "1000.00",
			status: "active",
		},
	});
	await db.payment.create({
		data: {
			organizationId: edge.id,
			leaseId: edgeLease.id,
			tenantId: edgeTenant.id,
			amount: "1000.00",
			dueDate: date("2026-08-01"),
			status: "pending",
		},
	});
	await db.message.create({
		data: {
			organizationId: edge.id,
			senderName: edgeTenant.name,
			senderEmail: edgeTenant.email,
			subject: "Isolation sentinel",
			content: "Must only appear in Boundary Estates.",
			category: "general",
		},
	});
	await db.activityLog.create({
		data: {
			organizationId: edge.id,
			action: "created",
			entity: "property",
			entityId: edgeProperty.id,
			details: "Isolation sentinel",
		},
	});

	const counts = Object.fromEntries(
		await Promise.all(
			[
				"organization",
				"user",
				"membership",
				"property",
				"propertyManager",
				"unit",
				"tenant",
				"lease",
				"payment",
				"paymentAdjustment",
				"maintenanceRequest",
				"message",
				"activityLog",
			].map(async (model) => [
				model,
				await (
					db[model as keyof typeof db] as { count(): Promise<number> }
				).count(),
			]),
		),
	);
	console.log("Seed counts:", counts);
	console.log(
		"Demo accounts:",
		accounts.map(([email, , role, active]) => ({ email, role, active })),
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => db.$disconnect());
