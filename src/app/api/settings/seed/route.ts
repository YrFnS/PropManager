import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { strictRateLimit } from '@/lib/validation';

export async function POST() {
  try {
    const rateLimitResult = strictRateLimit();
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Seed 5 properties with Arabic names
    const properties = await Promise.all([
      db.property.create({
        data: {
          name: 'Al Noor Tower',
          nameAr: 'برج النور',
          address: '123 King Fahd Road',
          addressAr: '١٢٣ طريق الملك فهد',
          city: 'Riyadh',
          cityAr: 'الرياض',
          state: 'Riyadh Province',
          zipCode: '12241',
          description: 'Modern residential tower with premium amenities',
          descriptionAr: 'برج سكني حديث بمرافق مميزة',
          type: 'residential',
          totalUnits: 3,
        },
      }),
      db.property.create({
        data: {
          name: 'Al Salam Residence',
          nameAr: 'سكن السلام',
          address: '456 Omar Ibn Al-Khattab Street',
          addressAr: '٤٥٦ شارع عمر بن الخطاب',
          city: 'Jeddah',
          cityAr: 'جدة',
          state: 'Makkah Province',
          zipCode: '21589',
          description: 'Family-oriented residential complex',
          descriptionAr: 'مجمع سكني عائلي',
          type: 'residential',
          totalUnits: 4,
        },
      }),
      db.property.create({
        data: {
          name: 'Al Faisal Plaza',
          nameAr: 'ساحة الفيصل',
          address: '789 Prince Sultan Road',
          addressAr: '٧٨٩ طريق الأمير سلطان',
          city: 'Dammam',
          cityAr: 'الدمام',
          state: 'Eastern Province',
          zipCode: '32253',
          description: 'Commercial and retail plaza',
          descriptionAr: 'ساحة تجارية ومتاجر',
          type: 'commercial',
          totalUnits: 3,
        },
      }),
      db.property.create({
        data: {
          name: 'Al Manar Building',
          nameAr: 'مبنى المنار',
          address: '321 Al Murooj Street',
          addressAr: '٣٢١ شارع المروج',
          city: 'Medina',
          cityAr: 'المدينة المنورة',
          state: 'Medina Province',
          zipCode: '42376',
          description: 'Mixed-use building with retail and residential units',
          descriptionAr: 'مبنى متعدد الاستخدامات بوحدات تجارية وسكنية',
          type: 'mixed',
          totalUnits: 3,
        },
      }),
      db.property.create({
        data: {
          name: 'Al Wahda Complex',
          nameAr: 'مجمع الوحدة',
          address: '654 Al Olaya District',
          addressAr: '٦٥٤ حي العليا',
          city: 'Riyadh',
          cityAr: 'الرياض',
          state: 'Riyadh Province',
          zipCode: '12211',
          description: 'Luxury residential complex',
          descriptionAr: 'مجمع سكني فاخر',
          type: 'residential',
          totalUnits: 2,
        },
      }),
    ]);

    // Seed property managers
    await Promise.all([
      db.propertyManager.create({
        data: { propertyId: properties[0].id, name: 'Khalid Al-Rashid', nameAr: 'خالد الراشد', email: 'khalid@alnour.sa', phone: '+966501234567' },
      }),
      db.propertyManager.create({
        data: { propertyId: properties[1].id, name: 'Ahmed Al-Otaibi', nameAr: 'أحمد العتيبي', email: 'ahmed@alsalam.sa', phone: '+966502345678' },
      }),
      db.propertyManager.create({
        data: { propertyId: properties[2].id, name: 'Mohammed Al-Harbi', nameAr: 'محمد الحربي', email: 'mohammed@alfaisal.sa', phone: '+966503456789' },
      }),
      db.propertyManager.create({
        data: { propertyId: properties[3].id, name: 'Sultan Al-Qahtani', nameAr: 'سلطان القحطاني', email: 'sultan@almanar.sa', phone: '+966504567890' },
      }),
      db.propertyManager.create({
        data: { propertyId: properties[4].id, name: 'Faisal Al-Dosari', nameAr: 'فيصل الدوسري', email: 'faisal@alwahda.sa', phone: '+966505678901' },
      }),
    ]);

    // Seed 15 units
    const unitsData = [
      { propertyId: properties[0].id, unitNumber: 'A-101', floor: 1, rooms: 2, bathrooms: 1, area: 85, rentAmount: 3500, status: 'rented' },
      { propertyId: properties[0].id, unitNumber: 'A-201', floor: 2, rooms: 3, bathrooms: 2, area: 120, rentAmount: 5000, status: 'rented' },
      { propertyId: properties[0].id, unitNumber: 'A-301', floor: 3, rooms: 1, bathrooms: 1, area: 60, rentAmount: 2500, status: 'available' },
      { propertyId: properties[1].id, unitNumber: 'B-101', floor: 1, rooms: 3, bathrooms: 2, area: 130, rentAmount: 4500, status: 'rented' },
      { propertyId: properties[1].id, unitNumber: 'B-102', floor: 1, rooms: 2, bathrooms: 1, area: 90, rentAmount: 3200, status: 'rented' },
      { propertyId: properties[1].id, unitNumber: 'B-201', floor: 2, rooms: 4, bathrooms: 2, area: 160, rentAmount: 6000, status: 'rented' },
      { propertyId: properties[1].id, unitNumber: 'B-202', floor: 2, rooms: 2, bathrooms: 1, area: 85, rentAmount: 3000, status: 'maintenance' },
      { propertyId: properties[2].id, unitNumber: 'C-101', floor: 1, rooms: 1, bathrooms: 1, area: 50, rentAmount: 7000, status: 'rented' },
      { propertyId: properties[2].id, unitNumber: 'C-102', floor: 1, rooms: 1, bathrooms: 1, area: 45, rentAmount: 6500, status: 'available' },
      { propertyId: properties[2].id, unitNumber: 'C-201', floor: 2, rooms: 2, bathrooms: 1, area: 75, rentAmount: 8000, status: 'rented' },
      { propertyId: properties[3].id, unitNumber: 'D-101', floor: 1, rooms: 1, bathrooms: 1, area: 40, rentAmount: 5500, status: 'rented' },
      { propertyId: properties[3].id, unitNumber: 'D-201', floor: 2, rooms: 2, bathrooms: 1, area: 95, rentAmount: 4000, status: 'rented' },
      { propertyId: properties[3].id, unitNumber: 'D-202', floor: 2, rooms: 3, bathrooms: 2, area: 110, rentAmount: 4800, status: 'available' },
      { propertyId: properties[4].id, unitNumber: 'E-101', floor: 1, rooms: 4, bathrooms: 3, area: 200, rentAmount: 8500, status: 'rented' },
      { propertyId: properties[4].id, unitNumber: 'E-201', floor: 2, rooms: 3, bathrooms: 2, area: 150, rentAmount: 6500, status: 'rented' },
    ];

    const units = await Promise.all(unitsData.map((u) => db.unit.create({ data: u })));

    // Seed 10 tenants
    const tenants = await Promise.all([
      db.tenant.create({ data: { name: 'Abdullah Al-Shehri', nameAr: 'عبدالله الشهري', email: 'abdullah.shehri@email.com', phone: '+966551111111', status: 'active' } }),
      db.tenant.create({ data: { name: 'Omar Al-Zahrani', nameAr: 'عمر الزهراني', email: 'omar.zahrani@email.com', phone: '+966552222222', status: 'active' } }),
      db.tenant.create({ data: { name: 'Youssef Al-Ghamdi', nameAr: 'يوسف الغامدي', email: 'youssef.ghamdi@email.com', phone: '+966553333333', status: 'active' } }),
      db.tenant.create({ data: { name: 'Ibrahim Al-Mutairi', nameAr: 'إبراهيم المطيري', email: 'ibrahim.mutairi@email.com', phone: '+966554444444', status: 'active' } }),
      db.tenant.create({ data: { name: 'Hassan Al-Subaie', nameAr: 'حسن السبيعي', email: 'hassan.subaie@email.com', phone: '+966555555555', status: 'active' } }),
      db.tenant.create({ data: { name: 'Ali Al-Shammari', nameAr: 'علي الشمري', email: 'ali.shammari@email.com', phone: '+966556666666', status: 'active' } }),
      db.tenant.create({ data: { name: 'Salman Al-Enazi', nameAr: 'سلمان العنزي', email: 'salman.enazi@email.com', phone: '+966557777777', status: 'active' } }),
      db.tenant.create({ data: { name: 'Turki Al-Balawi', nameAr: 'تركي البلوي', email: 'turki.balawi@email.com', phone: '+966558888888', status: 'active' } }),
      db.tenant.create({ data: { name: 'Nasser Al-Johani', nameAr: 'ناصر الجهني', email: 'nasser.johani@email.com', phone: '+966559999999', status: 'inactive' } }),
      db.tenant.create({ data: { name: 'Saeed Al-Amri', nameAr: 'سعيد العمري', email: 'saeed.amri@email.com', phone: '+966550000000', status: 'active' } }),
    ]);

    // Seed 8 leases
    const rentedUnits = units.filter((u) => u.status === 'rented');
    const leasesData = rentedUnits.slice(0, 8).map((unit, i) => ({
      unitId: unit.id,
      tenantId: tenants[i % tenants.length].id,
      startDate: new Date(2025, 0, 1 + i),
      endDate: new Date(2026, 0, 1 + i),
      rentAmount: unit.rentAmount,
      deposit: unit.rentAmount * 2,
      status: i < 6 ? 'active' : 'expired',
    }));

    const leases = await Promise.all(leasesData.map((l) => db.lease.create({ data: l })));

    // Seed 20 payments
    const paymentStatuses = ['paid', 'paid', 'paid', 'pending', 'late', 'paid', 'partial', 'paid'];
    const paymentMethods = ['bank_transfer', 'cash', 'online', 'bank_transfer', 'check', 'online', 'cash', 'bank_transfer'];

    const paymentsData: Array<{
      leaseId: string;
      tenantId: string;
      amount: number;
      dueDate: Date;
      paidDate: Date | null;
      status: string;
      method: string | null;
      reference: string | null;
      notes: string | null;
    }> = [];

    for (let i = 0; i < 20; i++) {
      const lease = leases[i % leases.length];
      const tenant = tenants[i % tenants.length];
      const status = paymentStatuses[i % paymentStatuses.length];
      const monthOffset = Math.floor(i / leases.length);
      const dueDate = new Date(2025, monthOffset, 1);
      const paidDate = status === 'paid' || status === 'partial' ? new Date(2025, monthOffset, 5 + (i % 10)) : null;

      paymentsData.push({
        leaseId: lease.id,
        tenantId: tenant.id,
        amount: lease.rentAmount,
        dueDate,
        paidDate,
        status,
        method: paymentMethods[i % paymentMethods.length],
        reference: `PAY-${String(i + 1).padStart(4, '0')}`,
        notes: null,
      });
    }

    await Promise.all(paymentsData.map((p) => db.payment.create({ data: p })));

    // Seed 6 maintenance requests
    const maintenanceData = [
      { propertyId: properties[0].id, unitId: units[0].id, tenantId: tenants[0].id, title: 'Leaking faucet in kitchen', titleAr: 'صنبور يتسرب في المطبخ', description: 'The kitchen faucet has been dripping constantly for 2 days', descriptionAr: 'صنبور المطبخ يتسرب باستمرار منذ يومين', priority: 'medium', status: 'open', category: 'plumbing', assignedTo: 'Technician Ahmed' },
      { propertyId: properties[1].id, unitId: units[3].id, tenantId: tenants[1].id, title: 'AC not cooling', titleAr: 'التكييف لا يبرد', description: 'Air conditioning unit is running but not cooling the apartment', descriptionAr: 'وحدة التكييف تعمل لكن لا تبرد الشقة', priority: 'high', status: 'in_progress', category: 'hvac', assignedTo: 'Technician Khalid' },
      { propertyId: properties[1].id, unitId: units[6].id, tenantId: null, title: 'Broken window in common area', titleAr: 'نافذة مكسورة في المنطقة المشتركة', description: 'Ground floor common area window was broken', descriptionAr: 'تم كسر نافذة المنطقة المشتركة في الطابق الأرضي', priority: 'urgent', status: 'open', category: 'structural', assignedTo: null },
      { propertyId: properties[2].id, unitId: units[7].id, tenantId: tenants[2].id, title: 'Electrical outlet not working', titleAr: 'المقبس الكهربائي لا يعمل', description: 'Two electrical outlets in the bedroom are not working', descriptionAr: 'مقبسان كهربائيان في غرفة النوم لا يعملان', priority: 'high', status: 'resolved', category: 'electrical', assignedTo: 'Technician Omar', completedAt: new Date('2025-06-01') },
      { propertyId: properties[3].id, unitId: units[10].id, tenantId: tenants[3].id, title: 'Water heater replacement needed', titleAr: 'يحتاج استبدال سخان المياه', description: 'Water heater is over 10 years old and making strange noises', descriptionAr: 'سخان المياه عمره أكثر من ١٠ سنوات ويصدر أصواتاً غريبة', priority: 'medium', status: 'open', category: 'appliance', assignedTo: null },
      { propertyId: properties[4].id, unitId: units[13].id, tenantId: tenants[4].id, title: 'Door lock malfunction', titleAr: 'عطل في قفل الباب', description: 'Main door lock is difficult to turn and sometimes gets stuck', descriptionAr: 'قفل الباب الرئيسي يصعب تدويره وأحياناً يعلق', priority: 'low', status: 'closed', category: 'other', assignedTo: 'Technician Ali', completedAt: new Date('2025-05-28') },
    ];

    await Promise.all(maintenanceData.map((m) => db.maintenanceRequest.create({ data: m })));

    // Seed 5 messages
    const messagesData = [
      { senderName: 'Abdullah Al-Shehri', senderEmail: 'abdullah.shehri@email.com', subject: 'Rent Payment Delay', content: 'I would like to inform you that my rent payment will be delayed by one week this month due to a banking issue. I apologize for the inconvenience.', isRead: false, category: 'payment' },
      { senderName: 'Omar Al-Zahrani', senderEmail: 'omar.zahrani@email.com', subject: 'Maintenance Request Update', content: 'Just wanted to follow up on my maintenance request for the AC unit. It has been 3 days and the issue is getting worse. Could you please expedite the repair?', isRead: false, category: 'maintenance' },
      { senderName: 'Youssef Al-Ghamdi', senderEmail: 'youssef.ghamdi@email.com', subject: 'Lease Renewal Inquiry', content: 'My current lease is expiring next month. I would like to discuss the terms for renewal. Are there any changes to the rent amount or lease conditions?', isRead: true, category: 'lease' },
      { senderName: 'Ibrahim Al-Mutairi', senderEmail: 'ibrahim.mutairi@email.com', subject: 'Noise Complaint', content: 'I am writing to complain about the excessive noise from the unit above mine, especially late at night. This has been happening for the past week and is affecting my sleep.', isRead: false, category: 'general' },
      { senderName: 'Hassan Al-Subaie', senderEmail: 'hassan.subaie@email.com', subject: 'Parking Space Issue', content: 'Someone has been parking in my assigned parking spot for the past few days. Could you please look into this and ensure the assigned spaces are respected?', isRead: true, category: 'general' },
    ];

    await Promise.all(messagesData.map((m) => db.message.create({ data: m })));

    return NextResponse.json({ success: true, message: 'Demo data seeded successfully' });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ success: false, error: 'Failed to seed demo data' }, { status: 500 });
  }
}
