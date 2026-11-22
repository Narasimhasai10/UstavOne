import bcrypt from '../backend/node_modules/bcryptjs/index.js';

export const KADAPA_BRANCH_IDS = [
  'h-kad-dsr-paradise',
  'h-kad-madhavi-conv',
  'h-kad-meda-reddy',
  'c-kad-subhamasthu',
  'c-kad-ks-cat',
  'c-kad-maharaja'
];

export const KADAPA_VENDORS = [
  {
    username: 'dsr_paradise',
    password: 'Vedika@paradise',
    businessName: 'DSR Paradise Function Hall',
    hallBusinessName: 'DSR Paradise Function Hall',
    cateringBusinessName: null,
    ownerType: 'hall',
    phone: '9000000011',
    email: 'dsr_paradise@utsavora.com',
    tradeLicenceNumber: 'TL-KDP-2024-9011'
  },
  {
    username: 'madhavi_convention',
    password: 'Vedika@MCC',
    businessName: 'Madhavi Convention Centre',
    hallBusinessName: 'Madhavi Convention Centre',
    cateringBusinessName: null,
    ownerType: 'hall',
    phone: '9000000012',
    email: 'madhavi_convention@utsavora.com',
    tradeLicenceNumber: 'TL-KDP-2024-9012'
  },
  {
    username: 'meda_reddy',
    password: 'Vedika@MRRCC',
    businessName: 'Meda Raghunadha Reddy Convention Centre',
    hallBusinessName: 'Meda Raghunadha Reddy Convention Centre',
    cateringBusinessName: null,
    ownerType: 'hall',
    phone: '9000000013',
    email: 'meda_reddy@utsavora.com',
    tradeLicenceNumber: 'TL-KDP-2024-9013'
  },
  {
    username: 'subhamasthu_catters',
    password: 'Vedika@SC',
    businessName: 'Subhamasthu Catters',
    hallBusinessName: null,
    cateringBusinessName: 'Subhamasthu Catters',
    ownerType: 'catering',
    phone: '9000000014',
    email: 'subhamasthu_catters@utsavora.com',
    fssaiNumber: '10123004009014'
  },
  {
    username: 'ks_cattering',
    password: 'Vedika@KSC',
    businessName: 'KS Catterings',
    hallBusinessName: null,
    cateringBusinessName: 'KS Catterings',
    ownerType: 'catering',
    phone: '9000000015',
    email: 'ks_cattering@utsavora.com',
    fssaiNumber: '10123004009015'
  },
  {
    username: 'maharaja',
    password: 'Vedika@Raja',
    businessName: 'Maharaja Catering',
    hallBusinessName: null,
    cateringBusinessName: 'Maharaja Catering',
    ownerType: 'catering',
    phone: '9000000016',
    email: 'maharaja@utsavora.com',
    fssaiNumber: '10123004009016'
  }
];

export async function deleteOldKadapaHallsAndCaterers(targetPrisma, kadapaCity, options = {}) {
  if (options && options.canRunDestructive === false) {
    console.log('[SKIP] destructive cleanup (pass --allow-destructive to enable)');
    return;
  }
  console.log('-> Deleting old Kadapa halls and caterers from database...');

  const saiUser = await targetPrisma.user.findUnique({ where: { username: 'sai_halls' } });
  const excludedVendorIds = saiUser ? [saiUser.id] : [];
  const excludedBranchIds = [
    ...KADAPA_BRANCH_IDS,
    'branch-sai-hall-1',
    'branch-sai-hall-2',
    'branch-annapurna-cat-1'
  ];

  // Find all branches in Kadapa of kind 'hall' or 'catering' that are NOT in excluded branches or belong to sai_halls
  const oldBranches = await targetPrisma.branch.findMany({
    where: {
      cityId: kadapaCity.id,
      kind: { in: ['hall', 'catering'] },
      NOT: {
        OR: [
          { id: { in: excludedBranchIds } },
          { vendorId: { in: excludedVendorIds } }
        ]
      }
    },
    select: { id: true, vendorId: true }
  });

  if (oldBranches.length > 0) {
    const oldBranchIds = oldBranches.map(b => b.id);
    const oldVendorIds = Array.from(new Set(oldBranches.map(b => b.vendorId)));

    // Delete related child records in order
    await targetPrisma.hallDetails.deleteMany({ where: { branchId: { in: oldBranchIds } } });
    await targetPrisma.catererDetails.deleteMany({ where: { branchId: { in: oldBranchIds } } });
    await targetPrisma.plateRate.deleteMany({ where: { branchId: { in: oldBranchIds } } });
    await targetPrisma.menuItem.deleteMany({ where: { branchId: { in: oldBranchIds } } });
    await targetPrisma.photo.deleteMany({ where: { branchId: { in: oldBranchIds } } });
    await targetPrisma.previousWork.deleteMany({ where: { branchId: { in: oldBranchIds } } });
    await targetPrisma.availabilityBlock.deleteMany({ where: { branchId: { in: oldBranchIds } } });
    await targetPrisma.bookingDate.deleteMany({ where: { branchId: { in: oldBranchIds } } });
    await targetPrisma.review.deleteMany({ where: { branchId: { in: oldBranchIds } } });

    const oldBookings = await targetPrisma.booking.findMany({
      where: { branchId: { in: oldBranchIds } },
      select: { id: true }
    });
    if (oldBookings.length > 0) {
      const oldBookingIds = oldBookings.map(b => b.id);
      await targetPrisma.refund.deleteMany({ where: { bookingId: { in: oldBookingIds } } });
      await targetPrisma.payment.deleteMany({ where: { bookingId: { in: oldBookingIds } } });
      await targetPrisma.payout.deleteMany({ where: { bookingId: { in: oldBookingIds } } });
      await targetPrisma.booking.deleteMany({ where: { id: { in: oldBookingIds } } });
    }

    // Find and delete conversations associated with these branches
    const convos = await targetPrisma.conversation.findMany({
      where: { branchId: { in: oldBranchIds } },
      select: { id: true }
    });
    if (convos.length > 0) {
      const convoIds = convos.map(c => c.id);
      await targetPrisma.message.deleteMany({ where: { conversationId: { in: convoIds } } });
      await targetPrisma.conversation.deleteMany({ where: { id: { in: convoIds } } });
    }

    // Finally delete branches
    await targetPrisma.branch.deleteMany({ where: { id: { in: oldBranchIds } } });

    // Delete old vendor users ONLY if they have NO branches left anywhere and are NOT 'sai_halls' or admin
    for (const vendorId of oldVendorIds) {
      const remainingBranches = await targetPrisma.branch.count({ where: { vendorId } });
      if (remainingBranches === 0) {
        const vendorUser = await targetPrisma.user.findUnique({ where: { id: vendorId } });
        if (vendorUser && vendorUser.username !== 'sai_halls' && vendorUser.role === 'vendor') {
          await targetPrisma.document.deleteMany({ where: { vendorId } });
          await targetPrisma.refreshToken.deleteMany({ where: { userId: vendorId } });
          await targetPrisma.vendorProfile.deleteMany({ where: { userId: vendorId } });
          await targetPrisma.user.delete({ where: { id: vendorId } });
        }
      }
    }
    console.log(`✅ Cleaned up ${oldBranches.length} old Kadapa branches and their associated records.`);
  }
}

export async function seedKadapaVendorsAndBranches(targetPrisma, kadapaCity, options = {}) {
  console.log('-> Seeding Kadapa 6 vendors & 6 branches...');

  // Step 1: Delete stale Kadapa branches
  if (options?.canRunDestructive) {
    await deleteOldKadapaHallsAndCaterers(targetPrisma, kadapaCity, options);
  } else {
    console.log('[SKIP] destructive cleanup (pass --allow-destructive to enable)');
  }

  // Step 2: Create/upsert the 6 vendor accounts with lowercase usernames
  const vendorMap = new Map();
  for (const v of KADAPA_VENDORS) {
    const usernameLower = v.username.toLowerCase();
    const passwordHash = await bcrypt.hash(v.password, 10);

    const user = await targetPrisma.user.upsert({
      where: { username: usernameLower },
      update: {
        name: v.businessName,
        phone: v.phone,
        email: v.email,
        city: 'Kadapa',
        state: 'Andhra Pradesh',
        role: 'vendor',
        passwordHash,
        isActive: true,
        failedLogins: 0,
        lockedUntil: null,
        locationSource: 'manual'
      },
      create: {
        name: v.businessName,
        username: usernameLower,
        phone: v.phone,
        email: v.email,
        city: 'Kadapa',
        state: 'Andhra Pradesh',
        role: 'vendor',
        passwordHash,
        isActive: true,
        failedLogins: 0,
        lockedUntil: null,
        locationSource: 'manual'
      }
    });

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

    vendorMap.set(usernameLower, user);

    if (v.tradeLicenceNumber) {
      await targetPrisma.document.upsert({
        where: { type_number: { type: 'trade_licence', number: v.tradeLicenceNumber } },
        update: { status: 'verified', vendorId: user.id },
        create: {
          vendorId: user.id,
          type: 'trade_licence',
          number: v.tradeLicenceNumber,
          status: 'verified'
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
          status: 'verified'
        }
      });
    }
  }

  // Step 3: Seed Hall Branches (3)
  // 1. DSR Paradise Function Hall
  const vDsr = vendorMap.get('dsr_paradise');
  const dsrBranch = await targetPrisma.branch.upsert({
    where: { id: 'h-kad-dsr-paradise' },
    update: {
      vendorId: vDsr.id,
      kind: 'hall',
      name: 'DSR Paradise Function Hall',
      description: 'Grand AC function hall with 1500 seated and 2250 floating capacity on Tirupati Bypass Road, Kadapa. Ideal for grand weddings and receptions.',
      addressLine: 'Bachchimpalle, Near Reliance Petrol Bunk, Tirupati Bypass Road, Ravindra Nagar, Kadapa 516003',
      area: 'Ravindra Nagar',
      cityId: kadapaCity.id,
      pincode: '516003',
      lat: 14.4673,
      lon: 78.8242,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['AC hall', 'Bridal room', 'Rooms', 'Power backup', 'Parking', 'Dining hall', 'Outside catering allowed'])
    },
    create: {
      id: 'h-kad-dsr-paradise',
      vendorId: vDsr.id,
      kind: 'hall',
      name: 'DSR Paradise Function Hall',
      description: 'Grand AC function hall with 1500 seated and 2250 floating capacity on Tirupati Bypass Road, Kadapa. Ideal for grand weddings and receptions.',
      addressLine: 'Bachchimpalle, Near Reliance Petrol Bunk, Tirupati Bypass Road, Ravindra Nagar, Kadapa 516003',
      area: 'Ravindra Nagar',
      cityId: kadapaCity.id,
      pincode: '516003',
      lat: 14.4673,
      lon: 78.8242,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['AC hall', 'Bridal room', 'Rooms', 'Power backup', 'Parking', 'Dining hall', 'Outside catering allowed'])
    }
  });

  await targetPrisma.hallDetails.upsert({
    where: { branchId: dsrBranch.id },
    update: {
      capacity: 2250,
      acMode: 'ac',
      priceFullDayAc: 150000,
      priceFullDayNonAc: 150000,
      priceHalfDay: null,
      parking: '120 cars, 300 bikes',
      rooms: 6
    },
    create: {
      branchId: dsrBranch.id,
      capacity: 2250,
      acMode: 'ac',
      priceFullDayAc: 150000,
      priceFullDayNonAc: 150000,
      priceHalfDay: null,
      parking: '120 cars, 300 bikes',
      rooms: 6
    }
  });

  // 2. Madhavi Convention Centre
  const vMadhavi = vendorMap.get('madhavi_convention');
  const madhaviBranch = await targetPrisma.branch.upsert({
    where: { id: 'h-kad-madhavi-conv' },
    update: {
      vendorId: vMadhavi.id,
      kind: 'hall',
      name: 'Madhavi Convention Centre',
      description: 'Premium AC convention centre with 1000 seated dining capacity on Rayachoty Road, Kadapa. Ideal for elegant weddings and major gatherings.',
      addressLine: 'Rayachoty Road, opposite RTO Office, Moolavanka, Utukur, Kadapa 516003',
      area: 'Utukur',
      cityId: kadapaCity.id,
      pincode: '516003',
      lat: 14.4421,
      lon: 78.8105,
      status: 'verified',
      ratingAvg: 4.4,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['AC hall', 'Dining space', 'Bridal room', 'Rooms', 'Power backup', 'Parking', 'Outside catering allowed'])
    },
    create: {
      id: 'h-kad-madhavi-conv',
      vendorId: vMadhavi.id,
      kind: 'hall',
      name: 'Madhavi Convention Centre',
      description: 'Premium AC convention centre with 1000 seated dining capacity on Rayachoty Road, Kadapa. Ideal for elegant weddings and major gatherings.',
      addressLine: 'Rayachoty Road, opposite RTO Office, Moolavanka, Utukur, Kadapa 516003',
      area: 'Utukur',
      cityId: kadapaCity.id,
      pincode: '516003',
      lat: 14.4421,
      lon: 78.8105,
      status: 'verified',
      ratingAvg: 4.4,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['AC hall', 'Dining space', 'Bridal room', 'Rooms', 'Power backup', 'Parking', 'Outside catering allowed'])
    }
  });

  await targetPrisma.hallDetails.upsert({
    where: { branchId: madhaviBranch.id },
    update: {
      capacity: 1500,
      acMode: 'ac',
      priceFullDayAc: 178018,
      priceFullDayNonAc: 178018,
      priceHalfDay: null,
      parking: '100 cars, 250 bikes',
      rooms: 8
    },
    create: {
      branchId: madhaviBranch.id,
      capacity: 1500,
      acMode: 'ac',
      priceFullDayAc: 178018,
      priceFullDayNonAc: 178018,
      priceHalfDay: null,
      parking: '100 cars, 250 bikes',
      rooms: 8
    }
  });

  // 3. Meda Raghunadha Reddy Convention Centre
  const vMeda = vendorMap.get('meda_reddy');
  const medaBranch = await targetPrisma.branch.upsert({
    where: { id: 'h-kad-meda-reddy' },
    update: {
      vendorId: vMeda.id,
      kind: 'hall',
      name: 'Meda Raghunadha Reddy Convention Centre',
      description: 'Centrally air-conditioned luxury convention centre with 3000 floating capacity, extensive dining space and parking in Chinna Chauku, Kadapa.',
      addressLine: '38/917, Revenue Ward No 38, Ramanjaneya Puram (near Sub Jail, beside Hanuman Temple), Chinna Chauku, Kadapa 516002',
      area: 'Chinna Chauku',
      cityId: kadapaCity.id,
      pincode: '516002',
      lat: 14.4755,
      lon: 78.8410,
      status: 'verified',
      ratingAvg: 4.4,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['Centrally air-conditioned', 'Dining space', 'Parking', 'Bridal room', 'Rooms', 'Power backup', 'Stage'])
    },
    create: {
      id: 'h-kad-meda-reddy',
      vendorId: vMeda.id,
      kind: 'hall',
      name: 'Meda Raghunadha Reddy Convention Centre',
      description: 'Centrally air-conditioned luxury convention centre with 3000 floating capacity, extensive dining space and parking in Chinna Chauku, Kadapa.',
      addressLine: '38/917, Revenue Ward No 38, Ramanjaneya Puram (near Sub Jail, beside Hanuman Temple), Chinna Chauku, Kadapa 516002',
      area: 'Chinna Chauku',
      cityId: kadapaCity.id,
      pincode: '516002',
      lat: 14.4755,
      lon: 78.8410,
      status: 'verified',
      ratingAvg: 4.4,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['Centrally air-conditioned', 'Dining space', 'Parking', 'Bridal room', 'Rooms', 'Power backup', 'Stage'])
    }
  });

  await targetPrisma.hallDetails.upsert({
    where: { branchId: medaBranch.id },
    update: {
      capacity: 3000,
      acMode: 'ac',
      priceFullDayAc: 250000,
      priceFullDayNonAc: 250000,
      priceHalfDay: null,
      parking: '200 cars, 500 bikes',
      rooms: 12
    },
    create: {
      branchId: medaBranch.id,
      capacity: 3000,
      acMode: 'ac',
      priceFullDayAc: 250000,
      priceFullDayNonAc: 250000,
      priceHalfDay: null,
      parking: '200 cars, 500 bikes',
      rooms: 12
    }
  });

  // Step 4: Seed Catering Branches (3)
  // 4. Subhamasthu Catters
  const vSubha = vendorMap.get('subhamasthu_catters');
  const subhaBranch = await targetPrisma.branch.upsert({
    where: { id: 'c-kad-subhamasthu' },
    update: {
      vendorId: vSubha.id,
      kind: 'catering',
      name: 'Subhamasthu Catters',
      description: 'Authentic Rayalaseema & Andhra catering services with dedicated live counters, signature chicken, and premium mutton & seafood preparations.',
      addressLine: '43/112, near Theja School, Prakash Nagar, Chinna Chauku 516004',
      area: 'Chinna Chauku',
      cityId: kadapaCity.id,
      pincode: '516004',
      lat: 14.4780,
      lon: 78.8390,
      status: 'verified',
      ratingAvg: 4.9,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['Veg and Non-Veg', 'Mutton & Seafood Specialty', 'Live Counters', 'Buffet & Leaf Service'])
    },
    create: {
      id: 'c-kad-subhamasthu',
      vendorId: vSubha.id,
      kind: 'catering',
      name: 'Subhamasthu Catters',
      description: 'Authentic Rayalaseema & Andhra catering services with dedicated live counters, signature chicken, and premium mutton & seafood preparations.',
      addressLine: '43/112, near Theja School, Prakash Nagar, Chinna Chauku 516004',
      area: 'Chinna Chauku',
      cityId: kadapaCity.id,
      pincode: '516004',
      lat: 14.4780,
      lon: 78.8390,
      status: 'verified',
      ratingAvg: 4.9,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['Veg and Non-Veg', 'Mutton & Seafood Specialty', 'Live Counters', 'Buffet & Leaf Service'])
    }
  });

  await targetPrisma.catererDetails.upsert({
    where: { branchId: subhaBranch.id },
    update: {
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both']),
      cuisines: JSON.stringify(['andhra', 'rayalaseema', 'south indian']),
      servingStyles: JSON.stringify(['buffet', 'banana leaf', 'table service']),
      minPlates: 50
    },
    create: {
      branchId: subhaBranch.id,
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both']),
      cuisines: JSON.stringify(['andhra', 'rayalaseema', 'south indian']),
      servingStyles: JSON.stringify(['buffet', 'banana leaf', 'table service']),
      minPlates: 50
    }
  });

  // Plate rates for Subhamasthu: veg / nonveg (chicken)
  await targetPrisma.plateRate.deleteMany({ where: { branchId: subhaBranch.id } });
  const subhaRates = [
    { category: 'basic', foodType: 'veg', price: 250 },
    { category: 'basic', foodType: 'nonveg', price: 380 },
    { category: 'standard', foodType: 'veg', price: 450 },
    { category: 'standard', foodType: 'nonveg', price: 600 },
    { category: 'premium', foodType: 'veg', price: 750 },
    { category: 'premium', foodType: 'nonveg', price: 950 },
    { category: 'luxury', foodType: 'veg', price: 1250 },
    { category: 'luxury', foodType: 'nonveg', price: 1500 }
  ];
  for (const r of subhaRates) {
    await targetPrisma.plateRate.create({
      data: { branchId: subhaBranch.id, category: r.category, foodType: r.foodType, price: r.price }
    });
  }

  // 5. KS Catterings
  const vKs = vendorMap.get('ks_cattering');
  const ksBranch = await targetPrisma.branch.upsert({
    where: { id: 'c-kad-ks-cat' },
    update: {
      vendorId: vKs.id,
      kind: 'catering',
      name: 'KS Catterings',
      description: 'Popular Rayalaseema catering service specializing in wedding feasts, traditional sweets, biryanis, and multi-cuisine spreads.',
      addressLine: 'Opposite Vurimi Savitri Hospital / Union Bank, Bhagya Nagar Colony',
      area: 'Bhagya Nagar Colony',
      cityId: kadapaCity.id,
      pincode: '',
      lat: 14.4710,
      lon: 78.8290,
      status: 'verified',
      ratingAvg: 4.9,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['Veg and Non-Veg', 'Wedding Spread', 'Live Counters', 'Buffet & Leaf Service'])
    },
    create: {
      id: 'c-kad-ks-cat',
      vendorId: vKs.id,
      kind: 'catering',
      name: 'KS Catterings',
      description: 'Popular Rayalaseema catering service specializing in wedding feasts, traditional sweets, biryanis, and multi-cuisine spreads.',
      addressLine: 'Opposite Vurimi Savitri Hospital / Union Bank, Bhagya Nagar Colony',
      area: 'Bhagya Nagar Colony',
      cityId: kadapaCity.id,
      pincode: '',
      lat: 14.4710,
      lon: 78.8290,
      status: 'verified',
      ratingAvg: 4.9,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['Veg and Non-Veg', 'Wedding Spread', 'Live Counters', 'Buffet & Leaf Service'])
    }
  });

  await targetPrisma.catererDetails.upsert({
    where: { branchId: ksBranch.id },
    update: {
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both']),
      cuisines: JSON.stringify(['andhra', 'rayalaseema', 'south indian']),
      servingStyles: JSON.stringify(['buffet', 'banana leaf']),
      minPlates: 50
    },
    create: {
      branchId: ksBranch.id,
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both']),
      cuisines: JSON.stringify(['andhra', 'rayalaseema', 'south indian']),
      servingStyles: JSON.stringify(['buffet', 'banana leaf']),
      minPlates: 50
    }
  });

  await targetPrisma.plateRate.deleteMany({ where: { branchId: ksBranch.id } });
  const ksRates = [
    { category: 'basic', foodType: 'veg', price: 150 },
    { category: 'basic', foodType: 'nonveg', price: 350 },
    { category: 'standard', foodType: 'veg', price: 250 },
    { category: 'standard', foodType: 'nonveg', price: 450 },
    { category: 'premium', foodType: 'veg', price: 350 },
    { category: 'premium', foodType: 'nonveg', price: 600 },
    { category: 'luxury', foodType: 'veg', price: 550 },
    { category: 'luxury', foodType: 'nonveg', price: 850 }
  ];
  for (const r of ksRates) {
    await targetPrisma.plateRate.create({
      data: { branchId: ksBranch.id, category: r.category, foodType: r.foodType, price: r.price }
    });
  }

  // 6. Maharaja Catering
  const vMaha = vendorMap.get('maharaja');
  const mahaBranch = await targetPrisma.branch.upsert({
    where: { id: 'c-kad-maharaja' },
    update: {
      vendorId: vMaha.id,
      kind: 'catering',
      name: 'Maharaja Catering',
      description: 'Royal catering service in Nagarajupeta, Kadapa. Known for royal multi-cuisine feasts, exotic starters, live stations, and traditional wedding spreads.',
      addressLine: 'Opposite Women\'s College, Koti Reddy Circle, Maria Puram, Nagarajupeta 516001',
      area: 'Nagarajupeta',
      cityId: kadapaCity.id,
      pincode: '516001',
      lat: 14.4725,
      lon: 78.8210,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['Pure Veg & Non-Veg', 'Royal Wedding Feasts', 'Multiple Live Stations', 'Exotic Desserts'])
    },
    create: {
      id: 'c-kad-maharaja',
      vendorId: vMaha.id,
      kind: 'catering',
      name: 'Maharaja Catering',
      description: 'Royal catering service in Nagarajupeta, Kadapa. Known for royal multi-cuisine feasts, exotic starters, live stations, and traditional wedding spreads.',
      addressLine: 'Opposite Women\'s College, Koti Reddy Circle, Maria Puram, Nagarajupeta 516001',
      area: 'Nagarajupeta',
      cityId: kadapaCity.id,
      pincode: '516001',
      lat: 14.4725,
      lon: 78.8210,
      status: 'verified',
      ratingAvg: 4.5,
      ratingCount: 0,
      bookingsCount: 3,
      amenities: JSON.stringify(['Pure Veg & Non-Veg', 'Royal Wedding Feasts', 'Multiple Live Stations', 'Exotic Desserts'])
    }
  });

  await targetPrisma.catererDetails.upsert({
    where: { branchId: mahaBranch.id },
    update: {
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both']),
      cuisines: JSON.stringify(['andhra', 'rayalaseema', 'north indian', 'chinese']),
      servingStyles: JSON.stringify(['buffet', 'banana leaf']),
      minPlates: 50
    },
    create: {
      branchId: mahaBranch.id,
      foodTypes: JSON.stringify(['veg', 'nonveg', 'both']),
      cuisines: JSON.stringify(['andhra', 'rayalaseema', 'north indian', 'chinese']),
      servingStyles: JSON.stringify(['buffet', 'banana leaf']),
      minPlates: 50
    }
  });

  await targetPrisma.plateRate.deleteMany({ where: { branchId: mahaBranch.id } });
  const mahaRates = [
    { category: 'basic', foodType: 'veg', price: 250 },
    { category: 'basic', foodType: 'nonveg', price: 400 },
    { category: 'standard', foodType: 'veg', price: 450 },
    { category: 'standard', foodType: 'nonveg', price: 650 },
    { category: 'premium', foodType: 'veg', price: 650 },
    { category: 'premium', foodType: 'nonveg', price: 950 },
    { category: 'luxury', foodType: 'veg', price: 900 },
    { category: 'luxury', foodType: 'nonveg', price: 1400 }
  ];
  for (const r of mahaRates) {
    await targetPrisma.plateRate.create({
      data: { branchId: mahaBranch.id, category: r.category, foodType: r.foodType, price: r.price }
    });
  }

  console.log('✅ Kadapa 6 vendors & 6 branches seeded successfully.');
  return vendorMap;
}

export async function seedKadapaSampleBookings(targetPrisma, kadapaVendorMap) {
  console.log('-> Seeding 3 sample completed bookings per Kadapa vendor (18 bookings total)...');

  const customerPhones = ['9390075877', '6305729847', '9963773539'];
  const customers = await targetPrisma.user.findMany({
    where: { phone: { in: customerPhones }, role: 'user' }
  });
  if (customers.length !== 3) {
    console.warn(`[seedKadapaSampleBookings] Expected 3 customers, found ${customers.length}`);
    return;
  }
  const custByPhone = {};
  customers.forEach(c => { custByPhone[c.phone] = c; });

  const sampleSpecs = [
    {
      username: 'dsr_paradise',
      branchId: 'h-kad-dsr-paradise',
      pricing: [150000, 150000, 150000]
    },
    {
      username: 'madhavi_convention',
      branchId: 'h-kad-madhavi-conv',
      pricing: [178018, 178018, 178018]
    },
    {
      username: 'meda_reddy',
      branchId: 'h-kad-meda-reddy',
      pricing: [250000, 275000, 300000]
    },
    {
      username: 'subhamasthu_catters',
      branchId: 'c-kad-subhamasthu',
      pricing: [135000, 240000, 380000]
    },
    {
      username: 'ks_cattering',
      branchId: 'c-kad-ks-cat',
      pricing: [100000, 180000, 260000]
    },
    {
      username: 'maharaja',
      branchId: 'c-kad-maharaja',
      pricing: [140000, 225000, 360000]
    }
  ];

  const bookingDates = [
    { start: '2026-07-12', end: '2026-07-12' },
    { start: '2026-08-20', end: '2026-08-20' },
    { start: '2026-09-18', end: '2026-09-18' }
  ];

  let bookingCodeSeq = 8019;

  for (const spec of sampleSpecs) {
    const vendorUser = kadapaVendorMap.get(spec.username.toLowerCase());
    if (!vendorUser) continue;

    for (let i = 0; i < 3; i++) {
      const cust = custByPhone[customerPhones[i]];
      const subtotal = spec.pricing[i];
      const gst = Math.round(subtotal * 0.18);
      const total = subtotal + gst;
      const commission = Math.round(subtotal * 0.10);
      const vendorPayout = subtotal - commission;
      const code = `VED-2026-${bookingCodeSeq++}`;
      const dt = bookingDates[i];

      const kind = spec.branchId.startsWith('h-') ? 'hall' : 'catering';
      const booking = await targetPrisma.booking.upsert({
        where: { code },
        update: {
          userId: cust.id,
          vendorId: vendorUser.id,
          branchId: spec.branchId,
          kind,
          subtotal,
          gst,
          total,
          commission,
          vendorPayout,
          status: 'completed',
          paymentStatus: 'paid'
        },
        create: {
          code,
          userId: cust.id,
          vendorId: vendorUser.id,
          branchId: spec.branchId,
          kind,
          eventType: i === 0 ? 'wedding' : (i === 1 ? 'reception' : 'birthday'),
          startDate: dt.start,
          endDate: dt.end,
          slot: 'full_day',
          guests: 500 + i * 150,
          subtotal,
          gst,
          total,
          commission,
          vendorPayout,
          status: 'completed',
          paymentStatus: 'paid'
        }
      });

      await targetPrisma.payment.upsert({
        where: { idempotencyKey: `PAY-${code}` },
        update: {
          bookingId: booking.id,
          amount: total,
          status: 'paid',
          provider: 'mock',
          method: 'upi'
        },
        create: {
          bookingId: booking.id,
          amount: total,
          status: 'paid',
          provider: 'mock',
          method: 'upi',
          idempotencyKey: `PAY-${code}`
        }
      });
    }
  }

  console.log('✅ 18 sample completed bookings seeded for Kadapa vendors successfully.');
}

export async function seedKadapaMenuItems(targetPrisma) {
  console.log('-> Seeding menu items for Kadapa catering branches...');
  const subhaItems = [
    { name: 'Gongura Chicken Starter', category: 'Starters', isVeg: false },
    { name: 'Crispy Corn Kernels', category: 'Starters', isVeg: true },
    { name: 'Mutton Sukka Fry', category: 'Starters', isVeg: false },
    { name: 'Paneer 65', category: 'Starters', isVeg: true },
    { name: 'Rayalaseema Ragi Sangati & Natu Kodi', category: 'Main Course', isVeg: false },
    { name: 'Nellore Chepala Pulusu (Fish Curry)', category: 'Main Course', isVeg: false },
    { name: 'Gutti Vankaya Kura', category: 'Main Course', isVeg: true },
    { name: 'Tomato Dal with Ghee', category: 'Main Course', isVeg: true },
    { name: 'Dum Mutton Biryani', category: 'Breads & Rice', isVeg: false },
    { name: 'Bagara Rice with Dalcha', category: 'Breads & Rice', isVeg: true },
    { name: 'Butter Naan', category: 'Breads & Rice', isVeg: true },
    { name: 'Kadapa Badam Halwa', category: 'Desserts', isVeg: true },
    { name: 'Double Ka Meetha', category: 'Desserts', isVeg: true }
  ];

  const ksItems = [
    { name: 'Chilli Chicken Dry', category: 'Starters', isVeg: false },
    { name: 'Veg Manchurian', category: 'Starters', isVeg: true },
    { name: 'Andhra Chicken Curry', category: 'Main Course', isVeg: false },
    { name: 'Paneer Butter Masala', category: 'Main Course', isVeg: true },
    { name: 'Yellow Moong Dal Fry', category: 'Main Course', isVeg: true },
    { name: 'Chicken Dum Biryani', category: 'Breads & Rice', isVeg: false },
    { name: 'Pulao & Sona Masoori Rice', category: 'Breads & Rice', isVeg: true },
    { name: 'Gulab Jamun with Ice Cream', category: 'Desserts', isVeg: true }
  ];

  const mahaItems = [
    { name: 'Apollo Fish Fry', category: 'Starters', isVeg: false },
    { name: 'Mutton Seekh Kebab', category: 'Starters', isVeg: false },
    { name: 'Hara Bhara Kebab', category: 'Starters', isVeg: true },
    { name: 'Royyala Iguru (Prawns Fry)', category: 'Main Course', isVeg: false },
    { name: 'Mutton Rogan Josh', category: 'Main Course', isVeg: false },
    { name: 'Kadai Paneer & Dal Makhani', category: 'Main Course', isVeg: true },
    { name: 'Special Chicken Biryani', category: 'Breads & Rice', isVeg: false },
    { name: 'Tandoori Roti & Naan', category: 'Breads & Rice', isVeg: true },
    { name: 'Shahi Tukda & Dry Fruit Kheer', category: 'Desserts', isVeg: true }
  ];

  await targetPrisma.menuItem.deleteMany({
    where: { branchId: { in: ['c-kad-subhamasthu', 'c-kad-ks-cat', 'c-kad-maharaja'] } }
  });

  for (const item of subhaItems) {
    await targetPrisma.menuItem.create({
      data: { branchId: 'c-kad-subhamasthu', ...item }
    });
  }
  for (const item of ksItems) {
    await targetPrisma.menuItem.create({
      data: { branchId: 'c-kad-ks-cat', ...item }
    });
  }
  for (const item of mahaItems) {
    await targetPrisma.menuItem.create({
      data: { branchId: 'c-kad-maharaja', ...item }
    });
  }
  console.log('✅ Kadapa menu items seeded successfully.');
}
