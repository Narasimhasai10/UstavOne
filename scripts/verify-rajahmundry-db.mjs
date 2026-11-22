import { PrismaClient } from '../backend/node_modules/@prisma/client/default.js';

const prisma = new PrismaClient();

async function verify() {
  const rajahmundryCity = await prisma.city.findFirst({ where: { city: 'Rajahmundry' } });
  console.log('Rajahmundry City:', rajahmundryCity?.id, rajahmundryCity?.city);

  const branches = await prisma.branch.findMany({
    where: { cityId: rajahmundryCity.id },
    include: { hallDetails: true, catererDetails: true, plateRates: true, menuItems: true, photos: true, works: true, bookings: true }
  });
  console.log('Total branches in Rajahmundry:', branches.length);
  const halls = branches.filter(b => b.kind === 'hall');
  const caterers = branches.filter(b => b.kind === 'catering');
  console.log('Halls count:', halls.length);
  console.log('Caterers count:', caterers.length);

  for (const b of branches) {
    console.log(
      'Branch:', b.id,
      '| Name:', b.name,
      '| Kind:', b.kind,
      '| Rating:', b.ratingAvg,
      '| Photos:', b.photos.length,
      '| Works:', b.works.length,
      '| PlateRates:', b.plateRates.length,
      '| MenuItems:', b.menuItems.length,
      '| Bookings:', b.bookings.length
    );
  }

  const branchIds = branches.map(b => b.id);
  const totalBookings = await prisma.booking.count({
    where: { branchId: { in: branchIds } }
  });
  console.log('Total bookings in Rajahmundry:', totalBookings);

  const convos = await prisma.conversation.count({
    where: { branchId: { in: branchIds } }
  });
  console.log('Total conversations in Rajahmundry:', convos);

  // Check 6 vendors
  const usernames = [
    'Sri_convention',
    'SVPC_halls',
    'SreeB_hall',
    'sai_caterings',
    'Emmi_caterings',
    'Ramya_caterings'
  ];

  for (const u of usernames) {
    const user = await prisma.user.findUnique({
      where: { username: u },
      include: { vendorProfile: true, vendorBookings: true }
    });
    console.log('Vendor:', u, '| Found:', !!user, '| Role:', user?.role, '| OwnerType:', user?.vendorProfile?.ownerType, '| Bookings:', user?.vendorBookings?.length);
  }

  await prisma.$disconnect();
}

verify().catch(console.error);
