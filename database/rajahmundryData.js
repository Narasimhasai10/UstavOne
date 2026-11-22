import bcrypt from '../backend/node_modules/bcryptjs/index.js';

export const RAJAHMUNDRY_BRANCH_IDS = [
  'branch-bvr-hall',
  'branch-bvr-cat',
  'branch-svpc-hall',
  'branch-svpc-cat',
  'branch-sreeb-hall',
  'branch-annapurna-cat',
  'branch-emmi-cat',
  'branch-ramya-cat'
];

export const RAJAHMUNDRY_VENDOR_USERNAMES = [
  'Sri_convention',
  'SVPC_halls',
  'SreeB_hall',
  'sai_caterings',
  'Emmi_caterings',
  'Ramya_caterings'
];

export const RAJAHMUNDRY_VENDORS = [
  {
    username: 'Sri_convention',
    password: 'Vedika@BVR',
    passwordHashSha256: 'da673aa09d9b6ddab8f2cb714d88306604741d333a1e500b9d885a87dc5dbe65',
    businessName: 'BVR Sri Convention',
    hallBusinessName: 'BVR Sri Convention',
    cateringBusinessName: 'BVR Sri Convention',
    ownerType: 'both',
    phone: '9000000001',
    email: 'sri_convention@utsavora.com',
    upiId: 'bvr.sri@okaxis',
    tradeLicenceNumber: 'TL-RJY-2024-9001',
    fssaiNumber: '10123004009001'
  },
  {
    username: 'SVPC_halls',
    password: 'Vedika@SVPC',
    passwordHashSha256: 'bcb339a112abc6c29d32e07a6c6bba567a3b6f4d7ff88985d3b6e7ec8921fffe',
    businessName: 'SVPC Conventions',
    hallBusinessName: 'SVPC Conventions',
    cateringBusinessName: 'SVPC Conventions',
    ownerType: 'both',
    phone: '9000000002',
    email: 'svpc_halls@utsavora.com',
    upiId: 'svpc.conventions@okaxis',
    tradeLicenceNumber: 'TL-RJY-2024-9002',
    fssaiNumber: '10123004009002'
  },
  {
    username: 'SreeB_hall',
    password: 'Vedika@SBH',
    passwordHashSha256: '242446da0e9989838e850b1b95f516a9c34985650822eb90b57de887e8218e9a',
    businessName: 'Sreerastu Banquet Hall',
    hallBusinessName: 'Sreerastu Banquet Hall',
    cateringBusinessName: null,
    ownerType: 'hall',
    phone: '9000000003',
    email: 'sreeb_hall@utsavora.com',
    upiId: 'sreerastu@okaxis',
    tradeLicenceNumber: 'TL-RJY-2024-9003',
    fssaiNumber: null
  },
  {
    username: 'sai_caterings',
    password: 'Vedika@annapurna',
    passwordHashSha256: 'f0f879d0f6c392fd030360aa1aacdcdbcd698443c12bdcdce58c775549eedaa1',
    businessName: 'Sai Annapurna Catering Services',
    hallBusinessName: null,
    cateringBusinessName: 'Sai Annapurna Catering Services',
    ownerType: 'catering',
    phone: '9000000004',
    email: 'sai_caterings@utsavora.com',
    upiId: 'sai.annapurna@okaxis',
    tradeLicenceNumber: null,
    fssaiNumber: '10123004009004'
  },
  {
    username: 'Emmi_caterings',
    password: 'Vedika@Emmi',
    passwordHashSha256: '21d896e882cf060832f6274ec416610a00d49859ea1cadfcd07dff247d6c09dc',
    businessName: 'Emmi Catering',
    hallBusinessName: null,
    cateringBusinessName: 'Emmi Catering',
    ownerType: 'catering',
    phone: '9000000005',
    email: 'emmi_caterings@utsavora.com',
    upiId: 'emmi.catering@okaxis',
    tradeLicenceNumber: null,
    fssaiNumber: '10123004009005'
  },
  {
    username: 'Ramya_caterings',
    password: 'Vedika@ramya',
    passwordHashSha256: '856c1b73f4f73a86d9977d38011c14458623b86e0e2df52c07dba520e032e917',
    businessName: 'Ramya Caterings and Wedding Planners',
    hallBusinessName: null,
    cateringBusinessName: 'Ramya Caterings and Wedding Planners',
    ownerType: 'catering',
    phone: '9000000006',
    email: 'ramya_caterings@utsavora.com',
    upiId: 'ramya.caterings@okaxis',
    tradeLicenceNumber: null,
    fssaiNumber: '10123004009006'
  }
];

export async function seedRajahmundryVendorsAndBranches(targetPrisma, rajahmundryCity, options = {}) {
  console.log('-> Seeding Rajahmundry 6 vendors & 8 branches...');

  // STEP 1: Delete any stale old Rajahmundry halls and caterers
  if (options?.canRunDestructive) {
    const oldBranches = await targetPrisma.branch.findMany({
      where: {
        cityId: rajahmundryCity.id,
        kind: { in: ['hall', 'catering'] },
        NOT: { id: { in: RAJAHMUNDRY_BRANCH_IDS } }
      },
      select: { id: true, vendorId: true }
    });

    if (oldBranches.length > 0) {
      const oldBranchIds = oldBranches.map(b => b.id);
      const oldVendorIds = Array.from(new Set(oldBranches.map(b => b.vendorId)));
      await targetPrisma.hallDetails.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.catererDetails.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.plateRate.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.menuItem.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.photo.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.previousWork.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.availabilityBlock.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.bookingDate.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.review.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.booking.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.conversation.deleteMany({ where: { branchId: { in: oldBranchIds } } });
      await targetPrisma.branch.deleteMany({ where: { id: { in: oldBranchIds } } });

      for (const vId of oldVendorIds) {
        const remaining = await targetPrisma.branch.count({ where: { vendorId: vId } });
        if (remaining === 0) {
          await targetPrisma.refreshToken.deleteMany({ where: { userId: vId } });
          await targetPrisma.document.deleteMany({ where: { vendorId: vId } });
          await targetPrisma.vendorProfile.deleteMany({ where: { userId: vId } });
          await targetPrisma.user.deleteMany({ where: { id: vId } });
        }
      }
    }
  } else {
    console.log('[SKIP] destructive cleanup (pass --allow-destructive to enable)');
  }

  // STEP 2: Create the 6 Vendor Accounts
  const vendorMap = new Map();
  for (const v of RAJAHMUNDRY_VENDORS) {
    const usernameLower = v.username.toLowerCase();
    const existing = await targetPrisma.user.findFirst({
      where: { OR: [{ username: v.username }, { username: usernameLower }] }
    });
    const passwordHash = await bcrypt.hash(v.password, 10);
    let user;
    if (existing) {
      user = await targetPrisma.user.update({
        where: { id: existing.id },
        data: {
          username: usernameLower,
          name: v.businessName,
          phone: v.phone,
          email: v.email,
          city: 'Rajahmundry',
          state: 'Andhra Pradesh',
          role: 'vendor',
          passwordHash,
          isActive: true,
          failedLogins: 0,
          lockedUntil: null
        }
      });
    } else {
      user = await targetPrisma.user.create({
        data: {
          name: v.businessName,
          username: usernameLower,
          phone: v.phone,
          email: v.email,
          city: 'Rajahmundry',
          state: 'Andhra Pradesh',
          role: 'vendor',
          passwordHash,
          isActive: true,
          failedLogins: 0,
          lockedUntil: null,
          locationSource: 'manual'
        }
      });
    }

    await targetPrisma.vendorProfile.upsert({
      where: { userId: user.id },
      update: {
        ownerType: v.ownerType,
        hallBusinessName: v.hallBusinessName,
        cateringBusinessName: v.cateringBusinessName,
        termsVersion: 'v1.0',
        status: 'active'
      },
      create: {
        userId: user.id,
        ownerType: v.ownerType,
        hallBusinessName: v.hallBusinessName,
        cateringBusinessName: v.cateringBusinessName,
        termsVersion: 'v1.0',
        status: 'active'
      }
    });

    if (v.tradeLicenceNumber) {
      await targetPrisma.document.upsert({
        where: { type_number: { type: 'trade_licence', number: v.tradeLicenceNumber } },
        update: { status: 'verified', vendorId: user.id },
        create: {
          vendorId: user.id,
          type: 'trade_licence',
          number: v.tradeLicenceNumber,
          status: 'verified',
          checks: JSON.stringify([{ rule: 'Verified via Govt Portal', passed: true }])
        }
      });
    }

    if (v.fssaiNumber) {
      await targetPrisma.document.upsert({
        where: { type_number: { type: 'fssai', number: v.fssaiNumber } },
        update: { status: 'verified', vendorId: user.id },
        create: {
          vendorId: user.id,
          type: 'fssai',
          number: v.fssaiNumber,
          status: 'verified',
          checks: JSON.stringify([{ rule: 'Verified via FSSAI FoSCoS', passed: true }])
        }
      });
    }

    vendorMap.set(v.username, user);
    vendorMap.set(usernameLower, user);
  }

  // STEP 3: Hall Branches
  // 1. BVR Sri Convention (Hall)
  const vBvr = vendorMap.get('Sri_convention');
  const bvrHall = await targetPrisma.branch.upsert({
    where: { id: 'branch-bvr-hall' },
    update: {
      vendorId: vBvr.id,
      kind: 'hall',
      name: 'BVR Sri Convention',
      description: 'Outside food and outside DJs allowed; outside decorators and outside alcohol not allowed; also provides catering and allows outside catering; supports veg and non-veg.',
      addressLine: 'Nimmakayala Market, Gadalamma Temple Road, near Morampudi, Sainagar, Morampudi, Rajamahendravaram, Andhra Pradesh 533107',
      area: 'Morampudi',
      cityId: rajahmundryCity.id,
      pincode: '533107',
      lat: 16.9983,
      lon: 81.7925,
      status: 'verified',
      ratingAvg: 4.4,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'Bridal room',
        'Rooms',
        'Power backup',
        'Parking (30 cars, 100 bikes)',
        'AC hall',
        'Outside catering allowed',
        'Veg and non-veg allowed',
        'Outside food allowed',
        'Outside DJ allowed',
        'Outside decorators not allowed',
        'Outside alcohol not allowed'
      ]),
      coverPhotoId: null
    },
    create: {
      id: 'branch-bvr-hall',
      vendorId: vBvr.id,
      kind: 'hall',
      name: 'BVR Sri Convention',
      description: 'Outside food and outside DJs allowed; outside decorators and outside alcohol not allowed; also provides catering and allows outside catering; supports veg and non-veg.',
      addressLine: 'Nimmakayala Market, Gadalamma Temple Road, near Morampudi, Sainagar, Morampudi, Rajamahendravaram, Andhra Pradesh 533107',
      area: 'Morampudi',
      cityId: rajahmundryCity.id,
      pincode: '533107',
      lat: 16.9983,
      lon: 81.7925,
      status: 'verified',
      ratingAvg: 4.4,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'Bridal room',
        'Rooms',
        'Power backup',
        'Parking (30 cars, 100 bikes)',
        'AC hall',
        'Outside catering allowed',
        'Veg and non-veg allowed',
        'Outside food allowed',
        'Outside DJ allowed',
        'Outside decorators not allowed',
        'Outside alcohol not allowed'
      ]),
      coverPhotoId: null
    }
  });

  await targetPrisma.hallDetails.upsert({
    where: { branchId: bvrHall.id },
    update: {
      capacity: 500,
      acMode: 'ac',
      priceFullDayAc: 150000,
      priceFullDayNonAc: 150000,
      priceHalfDay: 90000,
      parking: '30 cars and 100 bikes',
      rooms: 4
    },
    create: {
      branchId: bvrHall.id,
      capacity: 500,
      acMode: 'ac',
      priceFullDayAc: 150000,
      priceFullDayNonAc: 150000,
      priceHalfDay: 90000,
      parking: '30 cars and 100 bikes',
      rooms: 4
    }
  });

  // 2. SVPC Conventions (Hall)
  const vSvpc = vendorMap.get('SVPC_halls');
  const svpcHall = await targetPrisma.branch.upsert({
    where: { id: 'branch-svpc-hall' },
    update: {
      vendorId: vSvpc.id,
      kind: 'hall',
      name: 'SVPC Conventions',
      description: 'Cancellations are non-refundable. Also provides catering and allows outside catering. Supports veg and non-veg across 2 event areas.',
      addressLine: 'Plot No. 390/1A, NH16, opp. old Toyota Showroom, Divancheruvu, Rajamahendravaram, Palacherla, Andhra Pradesh 533353',
      area: 'Divancheruvu',
      cityId: rajahmundryCity.id,
      pincode: '533353',
      lat: 17.0652,
      lon: 81.8214,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'AC hall',
        '2 event areas',
        'Outside catering allowed',
        'Veg and non-veg allowed'
      ]),
      coverPhotoId: null
    },
    create: {
      id: 'branch-svpc-hall',
      vendorId: vSvpc.id,
      kind: 'hall',
      name: 'SVPC Conventions',
      description: 'Cancellations are non-refundable. Also provides catering and allows outside catering. Supports veg and non-veg across 2 event areas.',
      addressLine: 'Plot No. 390/1A, NH16, opp. old Toyota Showroom, Divancheruvu, Rajamahendravaram, Palacherla, Andhra Pradesh 533353',
      area: 'Divancheruvu',
      cityId: rajahmundryCity.id,
      pincode: '533353',
      lat: 17.0652,
      lon: 81.8214,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'AC hall',
        '2 event areas',
        'Outside catering allowed',
        'Veg and non-veg allowed'
      ]),
      coverPhotoId: null
    }
  });

  await targetPrisma.hallDetails.upsert({
    where: { branchId: svpcHall.id },
    update: {
      capacity: 700,
      acMode: 'ac',
      priceFullDayAc: 150000,
      priceFullDayNonAc: 150000,
      priceHalfDay: 90000,
      parking: '150 cars and 200 bikes',
      rooms: 6
    },
    create: {
      branchId: svpcHall.id,
      capacity: 700,
      acMode: 'ac',
      priceFullDayAc: 150000,
      priceFullDayNonAc: 150000,
      priceHalfDay: 90000,
      parking: '150 cars and 200 bikes',
      rooms: 6
    }
  });

  // 3. Sreerastu Banquet Hall (Hall)
  const vSreeb = vendorMap.get('SreeB_hall');
  const sreebHall = await targetPrisma.branch.upsert({
    where: { id: 'branch-sreeb-hall' },
    update: {
      vendorId: vSreeb.id,
      kind: 'hall',
      name: 'Sreerastu Banquet Hall',
      description: 'Centralised AC function hall for 200-300 guests, located opposite LIC office at Morampudi Junction.',
      addressLine: '14-195/2, Junction, opp. LIC office, Morampudi, Rajamahendravaram, Andhra Pradesh 533107',
      area: 'Morampudi',
      cityId: rajahmundryCity.id,
      pincode: '533107',
      lat: 16.9983,
      lon: 81.7925,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'AC hall',
        'Centralised AC',
        'Power backup'
      ]),
      coverPhotoId: null
    },
    create: {
      id: 'branch-sreeb-hall',
      vendorId: vSreeb.id,
      kind: 'hall',
      name: 'Sreerastu Banquet Hall',
      description: 'Centralised AC function hall for 200-300 guests, located opposite LIC office at Morampudi Junction.',
      addressLine: '14-195/2, Junction, opp. LIC office, Morampudi, Rajamahendravaram, Andhra Pradesh 533107',
      area: 'Morampudi',
      cityId: rajahmundryCity.id,
      pincode: '533107',
      lat: 16.9983,
      lon: 81.7925,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'AC hall',
        'Centralised AC',
        'Power backup'
      ]),
      coverPhotoId: null
    }
  });

  await targetPrisma.hallDetails.upsert({
    where: { branchId: sreebHall.id },
    update: {
      capacity: 300,
      acMode: 'ac',
      priceFullDayAc: 100000,
      priceFullDayNonAc: 100000,
      priceHalfDay: 60000,
      parking: '50 cars and 100 bikes',
      rooms: 2
    },
    create: {
      branchId: sreebHall.id,
      capacity: 300,
      acMode: 'ac',
      priceFullDayAc: 100000,
      priceFullDayNonAc: 100000,
      priceHalfDay: 60000,
      parking: '50 cars and 100 bikes',
      rooms: 2
    }
  });

  // STEP 4: Catering Branches
  // A) Sai Annapurna Catering Services (vendor sai_caterings) - Pure Veg ONLY
  const vAnnapurna = vendorMap.get('sai_caterings');
  const annapurnaCat = await targetPrisma.branch.upsert({
    where: { id: 'branch-annapurna-cat' },
    update: {
      vendorId: vAnnapurna.id,
      kind: 'catering',
      name: 'Sai Annapurna Catering Services',
      description: 'Pure vegetarian authentic Andhra & Brahmin style catering. Basic (10-15 dishes ₹200-350), Standard (15-20 dishes ₹350-550), Premium (20-30 dishes ₹550-850), Luxury (30+ dishes ₹850-1200+).',
      addressLine: 'Sai Annapurna Catering Services Rajahmundry, 7-7-2, 1 Vulithota Street, near 21st ward sachivalayam, Mangalavaripeta, Rajamahendravaram, Andhra Pradesh 533101',
      area: 'Mangalavaripeta',
      cityId: rajahmundryCity.id,
      pincode: '533101',
      lat: 17.0012,
      lon: 81.7785,
      status: 'verified',
      ratingAvg: 4.8,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'Pure Veg Only',
        'Traditional Banana Leaf',
        'Buffet Counters',
        'Brahmin Style Cooking',
        'Live Tawa Counter'
      ]),
      coverPhotoId: null
    },
    create: {
      id: 'branch-annapurna-cat',
      vendorId: vAnnapurna.id,
      kind: 'catering',
      name: 'Sai Annapurna Catering Services',
      description: 'Pure vegetarian authentic Andhra & Brahmin style catering. Basic (10-15 dishes ₹200-350), Standard (15-20 dishes ₹350-550), Premium (20-30 dishes ₹550-850), Luxury (30+ dishes ₹850-1200+).',
      addressLine: 'Sai Annapurna Catering Services Rajahmundry, 7-7-2, 1 Vulithota Street, near 21st ward sachivalayam, Mangalavaripeta, Rajamahendravaram, Andhra Pradesh 533101',
      area: 'Mangalavaripeta',
      cityId: rajahmundryCity.id,
      pincode: '533101',
      lat: 17.0012,
      lon: 81.7785,
      status: 'verified',
      ratingAvg: 4.8,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'Pure Veg Only',
        'Traditional Banana Leaf',
        'Buffet Counters',
        'Brahmin Style Cooking',
        'Live Tawa Counter'
      ]),
      coverPhotoId: null
    }
  });

  await targetPrisma.catererDetails.upsert({
    where: { branchId: annapurnaCat.id },
    update: {
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'brahmin style']),
      servingStyles: JSON.stringify(['banana leaf', 'buffet']),
      foodTypes: JSON.stringify(['veg'])
    },
    create: {
      branchId: annapurnaCat.id,
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'brahmin style']),
      servingStyles: JSON.stringify(['banana leaf', 'buffet']),
      foodTypes: JSON.stringify(['veg'])
    }
  });

  // Plate rates for Sai Annapurna: lower bounds (200, 350, 550, 850)
  await targetPrisma.plateRate.deleteMany({ where: { branchId: annapurnaCat.id } });
  const annapurnaPlateRates = [
    { category: 'basic', foodType: 'veg', price: 200 },
    { category: 'standard', foodType: 'veg', price: 350 },
    { category: 'premium', foodType: 'veg', price: 550 },
    { category: 'luxury', foodType: 'veg', price: 850 }
  ];
  for (const pr of annapurnaPlateRates) {
    await targetPrisma.plateRate.create({
      data: { branchId: annapurnaCat.id, ...pr }
    });
  }

  // Pure veg menu items for Sai Annapurna
  await targetPrisma.menuItem.deleteMany({ where: { branchId: annapurnaCat.id } });
  const annapurnaMenuItems = [
    { name: 'Garam Gulab Jamun', category: 'Sweets', isVeg: true },
    { name: 'Dry Fruit Bobbatlu / Puran Poli', category: 'Sweets', isVeg: true },
    { name: 'Kaju Carrot Halwa', category: 'Sweets', isVeg: true },
    { name: 'Traditional Badusha', category: 'Sweets', isVeg: true },
    { name: 'Mirchi Bajji & Punugulu', category: 'Starters', isVeg: true },
    { name: 'Crispy Veg Spring Rolls', category: 'Starters', isVeg: true },
    { name: 'Flavoured Pulihora', category: 'Rice & Mains', isVeg: true },
    { name: 'Authentic Veg Biryani', category: 'Rice & Mains', isVeg: true },
    { name: 'Steamed Sona Masoori Rice', category: 'Rice & Mains', isVeg: true },
    { name: 'Tomato Pappu with Pure Ghee', category: 'Rice & Mains', isVeg: true },
    { name: 'Gutti Vankaya Kura', category: 'Rice & Mains', isVeg: true },
    { name: 'Bendakaya Kaju Fry', category: 'Rice & Mains', isVeg: true },
    { name: 'Traditional Andhra Sambar', category: 'Rice & Mains', isVeg: true },
    { name: 'Majjiga Pulusu & Miriyala Rasam', category: 'Rice & Mains', isVeg: true },
    { name: 'Curd Rice with Pomegranate', category: 'Rice & Mains', isVeg: true },
    { name: 'Curd Vada (Dahi Vada)', category: 'Accompaniments', isVeg: true },
    { name: 'Aritaku Papad & Vadiyalu', category: 'Accompaniments', isVeg: true },
    { name: 'Gongura Pachadi & Kandi Podi with Ghee', category: 'Accompaniments', isVeg: true },
    { name: 'Live Dosa & Chaat Counter', category: 'Live Stations', isVeg: true },
    { name: 'Sweet Beeda / Paan & Ice Cream', category: 'Desserts', isVeg: true }
  ];
  for (const m of annapurnaMenuItems) {
    await targetPrisma.menuItem.create({
      data: { branchId: annapurnaCat.id, ...m }
    });
  }

  // B) Emmi Catering (vendor Emmi_caterings) - Veg & Non-Veg
  const vEmmi = vendorMap.get('Emmi_caterings');
  const emmiCat = await targetPrisma.branch.upsert({
    where: { id: 'branch-emmi-cat' },
    update: {
      vendorId: vEmmi.id,
      kind: 'catering',
      name: 'Emmi Catering',
      description: 'Veg and non-veg gourmet catering for grand events and weddings. Basic (10-15 items: veg ₹250-450, nonveg ₹400-650), Standard (15-20 items: veg ₹450-700, nonveg ₹650-950), Premium (20-30 items: veg ₹700-1100, nonveg ₹950-1500), Luxury (30+ items: veg ₹1100-1800+, nonveg ₹1500-2500+).',
      addressLine: 'Emmi Catering, WQXM+86H, Cotton Peta, Vemagiri, Dowlaiswaram, Andhra Pradesh 533125',
      area: 'Dowlaiswaram',
      cityId: rajahmundryCity.id,
      pincode: '533125',
      lat: 16.9482,
      lon: 81.7698,
      status: 'verified',
      ratingAvg: 4.9,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'Veg and Non-Veg',
        'Live Counters',
        'Multi-cuisine Buffet',
        'Dessert Bar'
      ]),
      coverPhotoId: null
    },
    create: {
      id: 'branch-emmi-cat',
      vendorId: vEmmi.id,
      kind: 'catering',
      name: 'Emmi Catering',
      description: 'Veg and non-veg gourmet catering for grand events and weddings. Basic (10-15 items: veg ₹250-450, nonveg ₹400-650), Standard (15-20 items: veg ₹450-700, nonveg ₹650-950), Premium (20-30 items: veg ₹700-1100, nonveg ₹950-1500), Luxury (30+ items: veg ₹1100-1800+, nonveg ₹1500-2500+).',
      addressLine: 'Emmi Catering, WQXM+86H, Cotton Peta, Vemagiri, Dowlaiswaram, Andhra Pradesh 533125',
      area: 'Dowlaiswaram',
      cityId: rajahmundryCity.id,
      pincode: '533125',
      lat: 16.9482,
      lon: 81.7698,
      status: 'verified',
      ratingAvg: 4.9,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'Veg and Non-Veg',
        'Live Counters',
        'Multi-cuisine Buffet',
        'Dessert Bar'
      ]),
      coverPhotoId: null
    }
  });

  await targetPrisma.catererDetails.upsert({
    where: { branchId: emmiCat.id },
    update: {
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'south indian', 'north indian', 'mughlai']),
      servingStyles: JSON.stringify(['buffet', 'table service']),
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both'])
    },
    create: {
      branchId: emmiCat.id,
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'south indian', 'north indian', 'mughlai']),
      servingStyles: JSON.stringify(['buffet', 'table service']),
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both'])
    }
  });

  // Plate rates for Emmi (price = lower bound)
  await targetPrisma.plateRate.deleteMany({ where: { branchId: emmiCat.id } });
  const emmiPlateRates = [
    { category: 'basic', foodType: 'veg', price: 250 },
    { category: 'basic', foodType: 'nonveg', price: 400 },
    { category: 'standard', foodType: 'veg', price: 450 },
    { category: 'standard', foodType: 'nonveg', price: 650 },
    { category: 'premium', foodType: 'veg', price: 700 },
    { category: 'premium', foodType: 'nonveg', price: 950 },
    { category: 'luxury', foodType: 'veg', price: 1100 },
    { category: 'luxury', foodType: 'nonveg', price: 1500 }
  ];
  for (const pr of emmiPlateRates) {
    await targetPrisma.plateRate.create({
      data: { branchId: emmiCat.id, ...pr }
    });
  }

  await targetPrisma.menuItem.deleteMany({ where: { branchId: emmiCat.id } });
  const emmiMenuItems = [
    { name: 'Paneer Tikka', category: 'Starters Veg', isVeg: true },
    { name: 'Crispy Corn Kernels', category: 'Starters Veg', isVeg: true },
    { name: 'Andhra Chilli Chicken', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Mutton Seekh Kebab', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Apollo Fish Fry', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Dum Hyderabadi Mutton Biryani', category: 'Main Course', isVeg: false },
    { name: 'Rayalaseema Natu Kodi Pulusu', category: 'Main Course', isVeg: false },
    { name: 'Gongura Mamsam', category: 'Main Course', isVeg: false },
    { name: 'Gutti Vankaya Kura', category: 'Main Course', isVeg: true },
    { name: 'Paneer Butter Masala', category: 'Main Course', isVeg: true },
    { name: 'Butter Naan & Roti', category: 'Breads & Rice', isVeg: true },
    { name: 'Gulab Jamun with Rabdi', category: 'Desserts', isVeg: true },
    { name: 'Live Jalebi & Chaat Counter', category: 'Live Stations', isVeg: true }
  ];
  for (const m of emmiMenuItems) {
    await targetPrisma.menuItem.create({
      data: { branchId: emmiCat.id, ...m }
    });
  }

  // C) Ramya Caterings and Wedding Planners (vendor Ramya_caterings) - Veg & Non-Veg + Wedding Planner
  const vRamya = vendorMap.get('Ramya_caterings');
  const ramyaCat = await targetPrisma.branch.upsert({
    where: { id: 'branch-ramya-cat' },
    update: {
      vendorId: vRamya.id,
      kind: 'catering',
      name: 'Ramya Caterings and Wedding Planners',
      description: 'Full wedding planning and catering service. Basic (10-15 dishes: veg ₹250-450, nonveg ₹400-650), Standard (15-20 dishes: veg ₹450-750, nonveg ₹650-1050), Premium (20-30 dishes: veg ₹750-1200, nonveg ₹1050-1650), Luxury (30+ dishes: veg ₹1200-1800+, nonveg ₹1650-2500+).',
      addressLine: 'Ramya Catering And Wedding Planners, Tyagaraju, Oruganti Vari St, Tyagaraja Nagar, Rajamahendravaram, Andhra Pradesh 533101',
      area: 'Tyagaraja Nagar',
      cityId: rajahmundryCity.id,
      pincode: '533101',
      lat: 16.9940,
      lon: 81.7820,
      status: 'verified',
      ratingAvg: 5.0,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'Wedding Planner Service',
        'Veg and Non-Veg',
        'Mocktail Counter',
        'Live Tawa & Chaat',
        'Elaborate Dessert Bar'
      ]),
      coverPhotoId: null
    },
    create: {
      id: 'branch-ramya-cat',
      vendorId: vRamya.id,
      kind: 'catering',
      name: 'Ramya Caterings and Wedding Planners',
      description: 'Full wedding planning and catering service. Basic (10-15 dishes: veg ₹250-450, nonveg ₹400-650), Standard (15-20 dishes: veg ₹450-750, nonveg ₹650-1050), Premium (20-30 dishes: veg ₹750-1200, nonveg ₹1050-1650), Luxury (30+ dishes: veg ₹1200-1800+, nonveg ₹1650-2500+).',
      addressLine: 'Ramya Catering And Wedding Planners, Tyagaraju, Oruganti Vari St, Tyagaraja Nagar, Rajamahendravaram, Andhra Pradesh 533101',
      area: 'Tyagaraja Nagar',
      cityId: rajahmundryCity.id,
      pincode: '533101',
      lat: 16.9940,
      lon: 81.7820,
      status: 'verified',
      ratingAvg: 5.0,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify([
        'Wedding Planner Service',
        'Veg and Non-Veg',
        'Mocktail Counter',
        'Live Tawa & Chaat',
        'Elaborate Dessert Bar'
      ]),
      coverPhotoId: null
    }
  });

  await targetPrisma.catererDetails.upsert({
    where: { branchId: ramyaCat.id },
    update: {
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'south indian', 'multi-cuisine', 'tandoori']),
      servingStyles: JSON.stringify(['buffet', 'table service', 'banana leaf']),
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both'])
    },
    create: {
      branchId: ramyaCat.id,
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'south indian', 'multi-cuisine', 'tandoori']),
      servingStyles: JSON.stringify(['buffet', 'table service', 'banana leaf']),
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both'])
    }
  });

  // Plate rates for Ramya (price = lower bound)
  await targetPrisma.plateRate.deleteMany({ where: { branchId: ramyaCat.id } });
  const ramyaPlateRates = [
    { category: 'basic', foodType: 'veg', price: 250 },
    { category: 'basic', foodType: 'nonveg', price: 400 },
    { category: 'standard', foodType: 'veg', price: 450 },
    { category: 'standard', foodType: 'nonveg', price: 650 },
    { category: 'premium', foodType: 'veg', price: 750 },
    { category: 'premium', foodType: 'nonveg', price: 1050 },
    { category: 'luxury', foodType: 'veg', price: 1200 },
    { category: 'luxury', foodType: 'nonveg', price: 1650 }
  ];
  for (const pr of ramyaPlateRates) {
    await targetPrisma.plateRate.create({
      data: { branchId: ramyaCat.id, ...pr }
    });
  }

  await targetPrisma.menuItem.deleteMany({ where: { branchId: ramyaCat.id } });
  const ramyaMenuItems = [
    { name: 'Hara Bhara Kebab & Paneer Tikka', category: 'Starters Veg', isVeg: true },
    { name: 'Tandoori Chicken & Mutton Chukka', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Prawns Iguru & Apollo Fish Fry', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Dum Mutton Biryani', category: 'Main Course', isVeg: false },
    { name: 'Special Chicken Biryani', category: 'Main Course', isVeg: false },
    { name: 'Gutti Vankaya & Paneer Tikka Masala', category: 'Main Course', isVeg: true },
    { name: 'Butter Naan, Kulcha & Tandoori Roti', category: 'Breads', isVeg: true },
    { name: 'Elaborate Dessert Bar & Rasmalai', category: 'Desserts', isVeg: true },
    { name: 'Mocktail & Fresh Fruit Counter', category: 'Live Stations', isVeg: true }
  ];
  for (const m of ramyaMenuItems) {
    await targetPrisma.menuItem.create({
      data: { branchId: ramyaCat.id, ...m }
    });
  }

  // D) The catering side of BVR Sri Convention & SVPC Conventions
  // NO plate prices given -> Leave plate rates empty! (Show "Rates on request")
  const bvrCat = await targetPrisma.branch.upsert({
    where: { id: 'branch-bvr-cat' },
    update: {
      vendorId: vBvr.id,
      kind: 'catering',
      name: 'BVR Sri Convention Catering',
      description: 'In-house and outside catering provided. Supports veg and non-veg. Rates on request.',
      addressLine: 'Nimmakayala Market, Gadalamma Temple Road, near Morampudi, Sainagar, Morampudi, Rajamahendravaram, Andhra Pradesh 533107',
      area: 'Morampudi',
      cityId: rajahmundryCity.id,
      pincode: '533107',
      lat: 16.9983,
      lon: 81.7925,
      status: 'verified',
      ratingAvg: 4.4,
      ratingCount: 0,
      bookingsCount: 0,
      amenities: JSON.stringify([
        'Outside catering allowed',
        'Veg and non-veg allowed',
        'Rates on request'
      ]),
      coverPhotoId: null
    },
    create: {
      id: 'branch-bvr-cat',
      vendorId: vBvr.id,
      kind: 'catering',
      name: 'BVR Sri Convention Catering',
      description: 'In-house and outside catering provided. Supports veg and non-veg. Rates on request.',
      addressLine: 'Nimmakayala Market, Gadalamma Temple Road, near Morampudi, Sainagar, Morampudi, Rajamahendravaram, Andhra Pradesh 533107',
      area: 'Morampudi',
      cityId: rajahmundryCity.id,
      pincode: '533107',
      lat: 16.9983,
      lon: 81.7925,
      status: 'verified',
      ratingAvg: 4.4,
      ratingCount: 0,
      bookingsCount: 0,
      amenities: JSON.stringify([
        'Outside catering allowed',
        'Veg and non-veg allowed',
        'Rates on request'
      ]),
      coverPhotoId: null
    }
  });

  await targetPrisma.catererDetails.upsert({
    where: { branchId: bvrCat.id },
    update: {
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'south indian', 'north indian']),
      servingStyles: JSON.stringify(['buffet']),
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both'])
    },
    create: {
      branchId: bvrCat.id,
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'south indian', 'north indian']),
      servingStyles: JSON.stringify(['buffet']),
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both'])
    }
  });
  // Empty PlateRate list
  await targetPrisma.plateRate.deleteMany({ where: { branchId: bvrCat.id } });
  await targetPrisma.menuItem.deleteMany({ where: { branchId: bvrCat.id } });

  const svpcCat = await targetPrisma.branch.upsert({
    where: { id: 'branch-svpc-cat' },
    update: {
      vendorId: vSvpc.id,
      kind: 'catering',
      name: 'SVPC Conventions Catering',
      description: 'In-house and outside catering provided. Supports veg and non-veg. Rates on request.',
      addressLine: 'Plot No. 390/1A, NH16, opp. old Toyota Showroom, Divancheruvu, Rajamahendravaram, Palacherla, Andhra Pradesh 533353',
      area: 'Divancheruvu',
      cityId: rajahmundryCity.id,
      pincode: '533353',
      lat: 17.0652,
      lon: 81.8214,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 0,
      amenities: JSON.stringify([
        'Outside catering allowed',
        'Veg and non-veg allowed',
        'Rates on request'
      ]),
      coverPhotoId: null
    },
    create: {
      id: 'branch-svpc-cat',
      vendorId: vSvpc.id,
      kind: 'catering',
      name: 'SVPC Conventions Catering',
      description: 'In-house and outside catering provided. Supports veg and non-veg. Rates on request.',
      addressLine: 'Plot No. 390/1A, NH16, opp. old Toyota Showroom, Divancheruvu, Rajamahendravaram, Palacherla, Andhra Pradesh 533353',
      area: 'Divancheruvu',
      cityId: rajahmundryCity.id,
      pincode: '533353',
      lat: 17.0652,
      lon: 81.8214,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 0,
      amenities: JSON.stringify([
        'Outside catering allowed',
        'Veg and non-veg allowed',
        'Rates on request'
      ]),
      coverPhotoId: null
    }
  });

  await targetPrisma.catererDetails.upsert({
    where: { branchId: svpcCat.id },
    update: {
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'south indian', 'north indian']),
      servingStyles: JSON.stringify(['buffet']),
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both'])
    },
    create: {
      branchId: svpcCat.id,
      minPlates: 50,
      cuisines: JSON.stringify(['andhra', 'south indian', 'north indian']),
      servingStyles: JSON.stringify(['buffet']),
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both'])
    }
  });
  // Empty PlateRate list
  await targetPrisma.plateRate.deleteMany({ where: { branchId: svpcCat.id } });
  await targetPrisma.menuItem.deleteMany({ where: { branchId: svpcCat.id } });

  console.log('✅ Rajahmundry 6 vendors & 8 branches seeded successfully.');
  return vendorMap;
}

export async function seedRajahmundryMenuItems(targetPrisma) {
  // Pure veg menu items for Sai Annapurna
  await targetPrisma.menuItem.deleteMany({ where: { branchId: 'branch-annapurna-cat' } });
  const annapurnaMenuItems = [
    { name: 'Garam Gulab Jamun', category: 'Sweets', isVeg: true },
    { name: 'Dry Fruit Bobbatlu / Puran Poli', category: 'Sweets', isVeg: true },
    { name: 'Kaju Carrot Halwa', category: 'Sweets', isVeg: true },
    { name: 'Traditional Badusha', category: 'Sweets', isVeg: true },
    { name: 'Mirchi Bajji & Punugulu', category: 'Starters', isVeg: true },
    { name: 'Crispy Veg Spring Rolls', category: 'Starters', isVeg: true },
    { name: 'Flavoured Pulihora', category: 'Rice & Mains', isVeg: true },
    { name: 'Authentic Veg Biryani', category: 'Rice & Mains', isVeg: true },
    { name: 'Steamed Sona Masoori Rice', category: 'Rice & Mains', isVeg: true },
    { name: 'Tomato Pappu with Pure Ghee', category: 'Rice & Mains', isVeg: true },
    { name: 'Gutti Vankaya Kura', category: 'Rice & Mains', isVeg: true },
    { name: 'Bendakaya Kaju Fry', category: 'Rice & Mains', isVeg: true },
    { name: 'Traditional Andhra Sambar', category: 'Rice & Mains', isVeg: true },
    { name: 'Majjiga Pulusu & Miriyala Rasam', category: 'Rice & Mains', isVeg: true },
    { name: 'Curd Rice with Pomegranate', category: 'Rice & Mains', isVeg: true },
    { name: 'Curd Vada (Dahi Vada)', category: 'Accompaniments', isVeg: true },
    { name: 'Aritaku Papad & Vadiyalu', category: 'Accompaniments', isVeg: true },
    { name: 'Gongura Pachadi & Kandi Podi with Ghee', category: 'Accompaniments', isVeg: true },
    { name: 'Live Dosa & Chaat Counter', category: 'Live Stations', isVeg: true },
    { name: 'Sweet Beeda / Paan & Ice Cream', category: 'Desserts', isVeg: true }
  ];
  for (const m of annapurnaMenuItems) {
    await targetPrisma.menuItem.create({
      data: { branchId: 'branch-annapurna-cat', ...m }
    });
  }

  // Emmi catering menu items
  await targetPrisma.menuItem.deleteMany({ where: { branchId: 'branch-emmi-cat' } });
  const emmiMenuItems = [
    { name: 'Paneer Tikka', category: 'Starters Veg', isVeg: true },
    { name: 'Crispy Corn Kernels', category: 'Starters Veg', isVeg: true },
    { name: 'Andhra Chilli Chicken', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Mutton Seekh Kebab', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Apollo Fish Fry', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Dum Hyderabadi Mutton Biryani', category: 'Main Course', isVeg: false },
    { name: 'Rayalaseema Natu Kodi Pulusu', category: 'Main Course', isVeg: false },
    { name: 'Gongura Mamsam', category: 'Main Course', isVeg: false },
    { name: 'Gutti Vankaya Kura', category: 'Main Course', isVeg: true },
    { name: 'Paneer Butter Masala', category: 'Main Course', isVeg: true },
    { name: 'Butter Naan & Roti', category: 'Breads & Rice', isVeg: true },
    { name: 'Gulab Jamun with Rabdi', category: 'Desserts', isVeg: true },
    { name: 'Live Jalebi & Chaat Counter', category: 'Live Stations', isVeg: true }
  ];
  for (const m of emmiMenuItems) {
    await targetPrisma.menuItem.create({
      data: { branchId: 'branch-emmi-cat', ...m }
    });
  }

  // Ramya catering menu items
  await targetPrisma.menuItem.deleteMany({ where: { branchId: 'branch-ramya-cat' } });
  const ramyaMenuItems = [
    { name: 'Hara Bhara Kebab & Paneer Tikka', category: 'Starters Veg', isVeg: true },
    { name: 'Tandoori Chicken & Mutton Chukka', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Prawns Iguru & Apollo Fish Fry', category: 'Starters Non-Veg', isVeg: false },
    { name: 'Dum Mutton Biryani', category: 'Main Course', isVeg: false },
    { name: 'Special Chicken Biryani', category: 'Main Course', isVeg: false },
    { name: 'Gutti Vankaya & Paneer Tikka Masala', category: 'Main Course', isVeg: true },
    { name: 'Butter Naan, Kulcha & Tandoori Roti', category: 'Breads', isVeg: true },
    { name: 'Elaborate Dessert Bar & Rasmalai', category: 'Desserts', isVeg: true },
    { name: 'Mocktail & Fresh Fruit Counter', category: 'Live Stations', isVeg: true }
  ];
  for (const m of ramyaMenuItems) {
    await targetPrisma.menuItem.create({
      data: { branchId: 'branch-ramya-cat', ...m }
    });
  }

  // Ensure BVR and SVPC catering have empty MenuItem lists
  await targetPrisma.menuItem.deleteMany({ where: { branchId: 'branch-bvr-cat' } });
  await targetPrisma.menuItem.deleteMany({ where: { branchId: 'branch-svpc-cat' } });
}

export async function seedRajahmundrySampleBookings(targetPrisma, vendorMap) {
  console.log('-> Seeding 3 sample completed bookings per Rajahmundry vendor (18 bookings total)...');

  // Customer users (the 3 existing customers)
  const cust1 = await targetPrisma.user.findUnique({ where: { phone: '9390075877' } });
  const cust2 = await targetPrisma.user.findUnique({ where: { phone: '6305729847' } });
  const cust3 = await targetPrisma.user.findUnique({ where: { phone: '9963773539' } });

  if (!cust1 || !cust2 || !cust3) {
    console.warn('⚠️ One or more customer users not found. Skipping sample bookings.');
    return;
  }

  const customers = [cust1, cust2, cust3];

  const sampleBookingsData = [
    // 1. Sri_convention (BVR Sri Convention) - Hall
    {
      vendorUsername: 'Sri_convention',
      branchId: 'branch-bvr-hall',
      kind: 'hall',
      eventType: 'wedding',
      startDate: '2026-08-15',
      endDate: '2026-08-15',
      guests: 500,
      subtotal: 150000,
      code: 'VED-2026-8001'
    },
    {
      vendorUsername: 'Sri_convention',
      branchId: 'branch-bvr-hall',
      kind: 'hall',
      eventType: 'reception',
      startDate: '2026-09-20',
      endDate: '2026-09-20',
      guests: 400,
      subtotal: 150000,
      code: 'VED-2026-8002'
    },
    {
      vendorUsername: 'Sri_convention',
      branchId: 'branch-bvr-hall',
      kind: 'hall',
      eventType: 'corporate',
      startDate: '2026-10-18',
      endDate: '2026-10-18',
      guests: 350,
      subtotal: 150000,
      code: 'VED-2026-8003'
    },

    // 2. SVPC_halls (SVPC Conventions) - Hall
    {
      vendorUsername: 'SVPC_halls',
      branchId: 'branch-svpc-hall',
      kind: 'hall',
      eventType: 'wedding',
      startDate: '2026-08-22',
      endDate: '2026-08-22',
      guests: 700,
      subtotal: 150000,
      code: 'VED-2026-8004'
    },
    {
      vendorUsername: 'SVPC_halls',
      branchId: 'branch-svpc-hall',
      kind: 'hall',
      eventType: 'reception',
      startDate: '2026-09-25',
      endDate: '2026-09-25',
      guests: 550,
      subtotal: 150000,
      code: 'VED-2026-8005'
    },
    {
      vendorUsername: 'SVPC_halls',
      branchId: 'branch-svpc-hall',
      kind: 'hall',
      eventType: 'engagement',
      startDate: '2026-10-24',
      endDate: '2026-10-24',
      guests: 450,
      subtotal: 150000,
      code: 'VED-2026-8006'
    },

    // 3. SreeB_hall (Sreerastu Banquet Hall) - Hall
    {
      vendorUsername: 'SreeB_hall',
      branchId: 'branch-sreeb-hall',
      kind: 'hall',
      eventType: 'birthday',
      startDate: '2026-08-28',
      endDate: '2026-08-28',
      guests: 250,
      subtotal: 100000,
      code: 'VED-2026-8007'
    },
    {
      vendorUsername: 'SreeB_hall',
      branchId: 'branch-sreeb-hall',
      kind: 'hall',
      eventType: 'anniversary',
      startDate: '2026-09-28',
      endDate: '2026-09-28',
      guests: 200,
      subtotal: 100000,
      code: 'VED-2026-8008'
    },
    {
      vendorUsername: 'SreeB_hall',
      branchId: 'branch-sreeb-hall',
      kind: 'hall',
      eventType: 'family_function',
      startDate: '2026-10-28',
      endDate: '2026-10-28',
      guests: 280,
      subtotal: 100000,
      code: 'VED-2026-8009'
    },

    // 4. sai_caterings (Sai Annapurna Catering Services) - Catering
    {
      vendorUsername: 'sai_caterings',
      branchId: 'branch-annapurna-cat',
      kind: 'catering',
      eventType: 'wedding',
      startDate: '2026-08-16',
      endDate: '2026-08-16',
      guests: 500,
      subtotal: 175000, // 350/plate * 500
      code: 'VED-2026-8010'
    },
    {
      vendorUsername: 'sai_caterings',
      branchId: 'branch-annapurna-cat',
      kind: 'catering',
      eventType: 'housewarming',
      startDate: '2026-09-14',
      endDate: '2026-09-14',
      guests: 300,
      subtotal: 105000, // 350/plate * 300
      code: 'VED-2026-8011'
    },
    {
      vendorUsername: 'sai_caterings',
      branchId: 'branch-annapurna-cat',
      kind: 'catering',
      eventType: 'family_function',
      startDate: '2026-10-12',
      endDate: '2026-10-12',
      guests: 400,
      subtotal: 220000, // 550/plate * 400
      code: 'VED-2026-8012'
    },

    // 5. Emmi_caterings (Emmi Catering) - Catering
    {
      vendorUsername: 'Emmi_caterings',
      branchId: 'branch-emmi-cat',
      kind: 'catering',
      eventType: 'wedding',
      startDate: '2026-08-20',
      endDate: '2026-08-20',
      guests: 450,
      subtotal: 202500, // 450/plate * 450
      code: 'VED-2026-8013'
    },
    {
      vendorUsername: 'Emmi_caterings',
      branchId: 'branch-emmi-cat',
      kind: 'catering',
      eventType: 'reception',
      startDate: '2026-09-18',
      endDate: '2026-09-18',
      guests: 350,
      subtotal: 227500, // 650/plate * 350
      code: 'VED-2026-8014'
    },
    {
      vendorUsername: 'Emmi_caterings',
      branchId: 'branch-emmi-cat',
      kind: 'catering',
      eventType: 'corporate',
      startDate: '2026-10-15',
      endDate: '2026-10-15',
      guests: 250,
      subtotal: 175000, // 700/plate * 250
      code: 'VED-2026-8015'
    },

    // 6. Ramya_caterings (Ramya Caterings and Wedding Planners) - Catering
    {
      vendorUsername: 'Ramya_caterings',
      branchId: 'branch-ramya-cat',
      kind: 'catering',
      eventType: 'wedding',
      startDate: '2026-08-26',
      endDate: '2026-08-26',
      guests: 500,
      subtotal: 225000, // 450/plate * 500
      code: 'VED-2026-8016'
    },
    {
      vendorUsername: 'Ramya_caterings',
      branchId: 'branch-ramya-cat',
      kind: 'catering',
      eventType: 'reception',
      startDate: '2026-09-22',
      endDate: '2026-09-22',
      guests: 400,
      subtotal: 260000, // 650/plate * 400
      code: 'VED-2026-8017'
    },
    {
      vendorUsername: 'Ramya_caterings',
      branchId: 'branch-ramya-cat',
      kind: 'catering',
      eventType: 'anniversary',
      startDate: '2026-10-20',
      endDate: '2026-10-20',
      guests: 300,
      subtotal: 225000, // 750/plate * 300
      code: 'VED-2026-8018'
    }
  ];

  for (let idx = 0; idx < sampleBookingsData.length; idx++) {
    const item = sampleBookingsData[idx];
    const customer = customers[idx % customers.length];
    const vendor = vendorMap.get(item.vendorUsername) || await targetPrisma.user.findUnique({ where: { username: item.vendorUsername } });

    const gst = Math.round((item.subtotal * 18) / 100);
    const total = item.subtotal + gst;
    const commission = Math.round((item.subtotal * 10) / 100);
    const vendorPayout = item.subtotal - commission;

    const bDate = new Date(`${item.startDate}T10:00:00Z`);

    const booking = await targetPrisma.booking.upsert({
      where: { code: item.code },
      update: {
        userId: customer.id,
        vendorId: vendor.id,
        branchId: item.branchId,
        kind: item.kind,
        eventType: item.eventType,
        startDate: item.startDate,
        endDate: item.endDate,
        slot: 'full_day',
        guests: item.guests,
        subtotal: item.subtotal,
        gst,
        total,
        commission,
        vendorPayout,
        status: 'completed',
        paymentStatus: 'paid',
        createdAt: bDate
      },
      create: {
        code: item.code,
        userId: customer.id,
        vendorId: vendor.id,
        branchId: item.branchId,
        kind: item.kind,
        eventType: item.eventType,
        startDate: item.startDate,
        endDate: item.endDate,
        slot: 'full_day',
        guests: item.guests,
        subtotal: item.subtotal,
        gst,
        total,
        commission,
        vendorPayout,
        status: 'completed',
        paymentStatus: 'paid',
        createdAt: bDate
      }
    });

    // Create Payment record
    await targetPrisma.payment.upsert({
      where: { idempotencyKey: `PAY-${item.code}` },
      update: {
        bookingId: booking.id,
        amount: total,
        status: 'paid',
        provider: 'mock',
        method: 'upi',
        createdAt: bDate
      },
      create: {
        bookingId: booking.id,
        amount: total,
        status: 'paid',
        provider: 'mock',
        method: 'upi',
        idempotencyKey: `PAY-${item.code}`,
        createdAt: bDate
      }
    });
  }

  console.log('✅ 18 sample completed bookings seeded successfully.');
}
