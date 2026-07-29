import { db } from '@/lib/db';

async function main() {
  console.log('Seeding database...');

  // Create Properties
  const properties = await Promise.all([
    db.property.create({
      data: {
        name: 'Sunset Towers',
        nameAr: 'أبراج الغروب',
        address: '123 Sunset Boulevard',
        addressAr: '١٢٣ شارع الغروب',
        city: 'Dubai',
        cityAr: 'دبي',
        state: 'Dubai',
        zipCode: '00001',
        description: 'Luxury residential towers with panoramic views',
        descriptionAr: 'أبراج سكنية فاخرة بإطلالات بانورامية',
        type: 'residential',
        totalUnits: 24,
        image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
        manager: {
          create: {
            name: 'Ahmed Al-Rashid',
            nameAr: 'أحمد الراشد',
            email: 'ahmed@sunsettowers.ae',
            phone: '+971-50-123-4567',
          },
        },
      },
    }),
    db.property.create({
      data: {
        name: 'Marina Heights',
        nameAr: 'مرينا هايتس',
        address: '456 Marina Walk',
        addressAr: '٤٥٦ ممشى المارينا',
        city: 'Dubai',
        cityAr: 'دبي',
        state: 'Dubai',
        zipCode: '00002',
        description: 'Premium waterfront apartments',
        descriptionAr: 'شقق فاخرة على الواجهة البحرية',
        type: 'residential',
        totalUnits: 36,
        image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        manager: {
          create: {
            name: 'Sara Al-Maktoum',
            nameAr: 'سارة المكتوم',
            email: 'sara@marinaheights.ae',
            phone: '+971-50-234-5678',
          },
        },
      },
    }),
    db.property.create({
      data: {
        name: 'Business Bay Plaza',
        nameAr: 'بلازا الخليج التجاري',
        address: '789 Business Bay',
        addressAr: '٧٨٩ الخليج التجاري',
        city: 'Dubai',
        cityAr: 'دبي',
        state: 'Dubai',
        zipCode: '00003',
        description: 'Modern commercial office spaces',
        descriptionAr: 'مكاتب تجارية حديثة',
        type: 'commercial',
        totalUnits: 18,
        image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
        manager: {
          create: {
            name: 'Mohammed Al-Fahim',
            nameAr: 'محمد الفهيم',
            email: 'mohammed@businessbay.ae',
            phone: '+971-50-345-6789',
          },
        },
      },
    }),
    db.property.create({
      data: {
        name: 'Palm Residence',
        nameAr: 'نخلة ريزيدنس',
        address: '321 Palm Jumeirah',
        addressAr: '٣٢١ نخلة جميرا',
        city: 'Dubai',
        cityAr: 'دبي',
        state: 'Dubai',
        zipCode: '00004',
        description: 'Exclusive beachfront living',
        descriptionAr: 'سكن حصري على شاطئ البحر',
        type: 'mixed',
        totalUnits: 12,
        image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80',
        manager: {
          create: {
            name: 'Fatima Al-Nahyan',
            nameAr: 'فاطمة النهيان',
            email: 'fatima@palmresidence.ae',
            phone: '+971-50-456-7890',
          },
        },
      },
    }),
    db.property.create({
      data: {
        name: 'Al Barsha Gardens',
        nameAr: 'حدائق البرشاء',
        address: '555 Al Barsha South',
        addressAr: '٥٥٥ البرشاء الجنوبية',
        city: 'Dubai',
        cityAr: 'دبي',
        state: 'Dubai',
        zipCode: '00005',
        description: 'Family-friendly residential community',
        descriptionAr: 'مجتمع سكني صديق للعائلات',
        type: 'residential',
        totalUnits: 30,
        image: 'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=1200&q=80',
        manager: {
          create: {
            name: 'Khalid Al-Mansoor',
            nameAr: 'خالد المنصور',
            email: 'khalid@albarsha.ae',
            phone: '+971-50-567-8901',
          },
        },
      },
    }),
  ]);

  console.log(`Created ${properties.length} properties`);

  // Create Units for each property
  const unitStatuses = ['available', 'rented', 'maintenance', 'rented', 'available', 'rented'];
  const unitData: any[] = [];

  for (const property of properties) {
    const unitCount = Math.min(property.totalUnits, 8);
    for (let i = 1; i <= unitCount; i++) {
      const floor = Math.ceil(i / 4);
      const rooms = [1, 2, 3, 4, 5][(i - 1) % 5];
      const bathrooms = rooms > 3 ? 2 : 1;
      const baseRent = property.type === 'commercial' ? 5000 : 2000;
      const rentAmount = baseRent + rooms * 800 + floor * 200;
      const status = unitStatuses[(i - 1) % unitStatuses.length];

      unitData.push({
        propertyId: property.id,
        unitNumber: `${floor}${String(i).padStart(2, '0')}`,
        floor,
        rooms,
        bathrooms,
        area: 40 + rooms * 25,
        rentAmount,
        status,
      });
    }
  }

  const units = await db.unit.createMany({ data: unitData });
  console.log(`Created ${unitData.length} units`);

  // Create Tenants
  const tenants = await Promise.all([
    db.tenant.create({
      data: {
        name: 'Omar Hassan',
        nameAr: 'عمر حسن',
        email: 'omar.hassan@email.com',
        phone: '+971-55-111-2222',
        nationalId: 'UAE-001234',
        emergencyContact: '+971-55-111-3333',
        status: 'active',
      },
    }),
    db.tenant.create({
      data: {
        name: 'Layla Mahmoud',
        nameAr: 'ليلى محمود',
        email: 'layla.m@email.com',
        phone: '+971-55-222-3333',
        nationalId: 'UAE-002345',
        emergencyContact: '+971-55-222-4444',
        status: 'active',
      },
    }),
    db.tenant.create({
      data: {
        name: 'David Chen',
        nameAr: 'ديفيد تشن',
        email: 'david.chen@email.com',
        phone: '+971-55-333-4444',
        nationalId: 'UAE-003456',
        emergencyContact: '+971-55-333-5555',
        status: 'active',
      },
    }),
    db.tenant.create({
      data: {
        name: 'Nour Al-Din',
        nameAr: 'نور الدين',
        email: 'nour.aldin@email.com',
        phone: '+971-55-444-5555',
        nationalId: 'UAE-004567',
        emergencyContact: '+971-55-444-6666',
        status: 'active',
      },
    }),
    db.tenant.create({
      data: {
        name: 'Sarah Johnson',
        nameAr: 'سارة جونسون',
        email: 'sarah.j@email.com',
        phone: '+971-55-555-6666',
        nationalId: 'UAE-005678',
        emergencyContact: '+971-55-555-7777',
        status: 'active',
      },
    }),
    db.tenant.create({
      data: {
        name: 'Ali Reza',
        nameAr: 'علي رضا',
        email: 'ali.reza@email.com',
        phone: '+971-55-666-7777',
        nationalId: 'UAE-006789',
        emergencyContact: '+971-55-666-8888',
        status: 'active',
      },
    }),
    db.tenant.create({
      data: {
        name: 'Maria Santos',
        nameAr: 'ماريا سانتوس',
        email: 'maria.s@email.com',
        phone: '+971-55-777-8888',
        nationalId: 'UAE-007890',
        emergencyContact: '+971-55-777-9999',
        status: 'active',
      },
    }),
    db.tenant.create({
      data: {
        name: 'Yusuf Kamal',
        nameAr: 'يوسف كمال',
        email: 'yusuf.k@email.com',
        phone: '+971-55-888-9999',
        nationalId: 'UAE-008901',
        emergencyContact: '+971-55-888-0000',
        status: 'inactive',
      },
    }),
  ]);

  console.log(`Created ${tenants.length} tenants`);

  // Create Leases for rented units
  const allUnits = await db.unit.findMany({ where: { status: 'rented' } });
  const leaseData: any[] = [];
  const activeTenants = tenants.filter(t => t.status === 'active');

  for (let i = 0; i < allUnits.length && i < activeTenants.length; i++) {
    const unit = allUnits[i];
    const tenant = activeTenants[i];
    const startDate = new Date(2025, Math.floor(Math.random() * 6) + 1, 1);
    const endDate = new Date(2026, startDate.getMonth() + 1, 0);

    leaseData.push({
      unitId: unit.id,
      tenantId: tenant.id,
      startDate,
      endDate,
      rentAmount: unit.rentAmount,
      deposit: Number(unit.rentAmount) * 2,
      status: 'active',
    });
  }

  const leases = await db.lease.createMany({ data: leaseData });
  console.log(`Created ${leaseData.length} leases`);

  // Create Payments for each lease
  const allLeases = await db.lease.findMany({ include: { unit: true } });
  const paymentData: any[] = [];
  const methods = ['cash', 'bank_transfer', 'online', 'check'];

  for (const lease of allLeases) {
    for (let month = 0; month < 6; month++) {
      const dueDate = new Date(2026, month, 1);
      const isPast = month < 3;
      const isLate = month === 3 && Math.random() > 0.5;
      const isPaid = isPast || (!isLate && Math.random() > 0.2);

      paymentData.push({
        leaseId: lease.id,
        tenantId: lease.tenantId,
        amount: lease.rentAmount,
        dueDate,
        paidDate: isPaid ? new Date(2026, month, Math.floor(Math.random() * 10) + 1) : null,
        status: isPaid ? 'paid' : isLate ? 'late' : 'pending',
        method: isPaid ? methods[Math.floor(Math.random() * methods.length)] : null,
        reference: isPaid ? `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` : null,
      });
    }
  }

  const payments = await db.payment.createMany({ data: paymentData });
  console.log(`Created ${paymentData.length} payments`);

  // Create Maintenance Requests
  const allProperties = await db.property.findMany();
  const maintenanceData: any[] = [];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const statuses = ['open', 'in_progress', 'resolved', 'closed'];
  const categories = ['plumbing', 'electrical', 'structural', 'appliance', 'hvac', 'other'];
  const maintenanceTitles = [
    { title: 'Leaking kitchen faucet', titleAr: 'حنفية المطبخ تتسرب', desc: 'Water dripping from kitchen faucet continuously', descAr: 'الماء يقطر من حنفية المطبخ باستمرار' },
    { title: 'AC not cooling', titleAr: 'التكييف لا يبرد', desc: 'Air conditioning unit running but not cooling the room', descAr: 'وحدة التكييف تعمل لكنها لا تبرد الغرفة' },
    { title: 'Broken window lock', titleAr: 'قفل النافذة مكسور', desc: 'Window lock on bedroom window is broken', descAr: 'قفل نافذة غرفة النوم مكسور' },
    { title: 'Elevator malfunction', titleAr: 'عطل المصعد', desc: 'Elevator stuck between floors intermittently', descAr: 'المصعد عالق بين الطوابق بشكل متقطع' },
    { title: 'Water heater issue', titleAr: 'مشكلة في سخان الماء', desc: 'No hot water coming from taps', descAr: 'لا يوجد ماء ساخن من الحنفيات' },
    { title: 'Parking gate stuck', titleAr: 'بوابة مواقف عالقة', desc: 'Automatic parking gate not opening', descAr: 'بوابة المواقف الآلية لا تفتح' },
    { title: 'Wall cracks in living room', titleAr: 'شقوق في جدار الغرفة', desc: 'Large cracks appearing in living room wall', descAr: 'شقوق كبيرة تظهر في جدار غرفة المعيشة' },
    { title: 'Dishwasher not draining', titleAr: 'غسالة الصحون لا تصرف', desc: 'Water not draining from dishwasher', descAr: 'الماء لا يُصرّف من غسالة الصحون' },
    { title: 'Intercom system down', titleAr: 'نظام الاتصال الداخلي معطل', desc: 'Building intercom not working', descAr: 'جهاز الاتصال الداخلي لا يعمل' },
    { title: 'Bathroom tile damage', titleAr: 'تلف بلاط الحمام', desc: 'Several bathroom tiles cracked and loose', descAr: 'عدة بلاطات الحمام متشققة ومرخية' },
  ];

  for (let i = 0; i < 12; i++) {
    const prop = allProperties[i % allProperties.length];
    const m = maintenanceTitles[i % maintenanceTitles.length];
    const priority = priorities[i % priorities.length];
    const status = statuses[Math.min(Math.floor(i / 3), 3)];
    const tenant = activeTenants[i % activeTenants.length];
    const rentedUnit = await db.unit.findFirst({ where: { propertyId: prop.id, status: 'rented' } });

    maintenanceData.push({
      propertyId: prop.id,
      unitId: rentedUnit?.id || null,
      tenantId: tenant.id,
      title: m.title,
      titleAr: m.titleAr,
      description: m.desc,
      descriptionAr: m.descAr,
      priority,
      status,
      category: categories[i % categories.length],
      assignedTo: status !== 'open' ? 'Maintenance Team A' : null,
      completedAt: status === 'closed' || status === 'resolved' ? new Date() : null,
    });
  }

  const maintenance = await db.maintenanceRequest.createMany({ data: maintenanceData });
  console.log(`Created ${maintenanceData.length} maintenance requests`);

  // Create Messages
  const messageData: any[] = [];
  const messagesList = [
    { senderName: 'Omar Hassan', senderEmail: 'omar.hassan@email.com', subject: 'Rent Payment Inquiry', content: 'I would like to know about the available payment methods for next month.', category: 'payment' },
    { senderName: 'Layla Mahmoud', senderEmail: 'layla.m@email.com', subject: 'Maintenance Request Follow-up', content: 'Could you please provide an update on the AC repair request?', category: 'maintenance' },
    { senderName: 'David Chen', senderEmail: 'david.chen@email.com', subject: 'Lease Renewal', content: 'My lease is ending next month. I would like to discuss renewal options.', category: 'lease' },
    { senderName: 'Nour Al-Din', senderEmail: 'nour.aldin@email.com', subject: 'Parking Space', content: 'Is there an additional parking space available for rent?', category: 'general' },
    { senderName: 'Sarah Johnson', senderEmail: 'sarah.j@email.com', subject: 'Noise Complaint', content: 'There is excessive noise from the unit above me during late hours.', category: 'general' },
    { senderName: 'Ali Reza', senderEmail: 'ali.reza@email.com', subject: 'Move-out Notice', content: 'I will be vacating the unit at the end of my lease term.', category: 'lease' },
    { senderName: 'Maria Santos', senderEmail: 'maria.s@email.com', subject: 'Community Event', content: 'When is the next community meeting scheduled?', category: 'general' },
    { senderName: 'Omar Hassan', senderEmail: 'omar.hassan@email.com', subject: 'Late Payment', content: 'I apologize for the delay. Will pay by end of this week.', category: 'payment' },
  ];

  for (let i = 0; i < messagesList.length; i++) {
    messageData.push({
      ...messagesList[i],
      isRead: i > 2,
    });
  }

  const msgs = await db.message.createMany({ data: messageData });
  console.log(`Created ${messageData.length} messages`);

  // Create Activity Logs
  const activityData = [
    { action: 'created', entity: 'property', details: 'Sunset Towers was added' },
    { action: 'created', entity: 'lease', details: 'New lease signed for Unit 101' },
    { action: 'payment', entity: 'payment', details: 'Payment received from Omar Hassan' },
    { action: 'created', entity: 'maintenance', details: 'New maintenance request: AC not cooling' },
    { action: 'updated', entity: 'tenant', details: 'Tenant profile updated for Layla Mahmoud' },
    { action: 'resolved', entity: 'maintenance', details: 'Leaking faucet repair completed' },
  ];

  for (const activity of activityData) {
    await db.activityLog.create({ data: activity });
  }

  console.log('Seeding completed!');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
