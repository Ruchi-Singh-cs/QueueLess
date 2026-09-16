// Demo data: vendors, shops with locations/services, an admin, customers, live queues, a few appointments.
// Run: npm run seed            (same MONGO_URI / embedded db as the server; idempotent — shops are matched by name)
//      npm run seed -- 28.6139 77.2090   (drop the demo city somewhere else: <lat> <lng>)
import bcrypt from 'bcryptjs';
import { User, Queue, Token, Appointment } from './src/models.js';

const argLat = Number(process.argv[2]), argLng = Number(process.argv[3]);
const CENTER = Number.isFinite(argLat) && Number.isFinite(argLng) ? { lat: argLat, lng: argLng }
  : { lat: Number(process.env.SEED_LAT) || 26.4499, lng: Number(process.env.SEED_LNG) || 80.3319 }; // Kanpur
const PASSWORD = 'password';
const img = (id) => `https://images.unsplash.com/${id}?w=1200&q=70&auto=format&fit=crop`;

// dLat/dLng are offsets from CENTER in degrees (~0.01 ≈ 1.1 km). queue = people in line (first one is being served); served = done earlier today.
const SHOPS = [
  // --- medical ---
  { name: 'Dr. Sharma Clinic', category: 'medical', dLat: 0.004, dLng: 0.006, avg: 6, queue: 3, served: 9, street: '12 Mall Road', phone: '+91 98765 11111', image: img('photo-1519494026892-80bbd2d6fd0d'),
    description: 'Family physician. Walk-ins welcome, appointments preferred.', services: [['General Consultation', 10], ['Follow-up', 6], ['Emergency', 15]] },
  { name: 'Smile Dental Care', category: 'medical', dLat: -0.03, dLng: 0.03, avg: 18, queue: 2, served: 4, street: '7 Swaroop Nagar', phone: '+91 98765 66666', image: img('photo-1606811841689-23dfddce3e95'),
    description: 'Dental check-ups, cleaning and orthodontics.', services: [['Check-up', 15], ['Cleaning', 25], ['Filling', 30]] },
  { name: 'Kakadeo Eye Care', category: 'medical', dLat: 0.028, dLng: -0.035, avg: 12, queue: 5, served: 11, street: '118/44 Kakadeo', phone: '+91 98765 77777', image: img('photo-1579684385127-1ef15d508118'),
    description: 'Eye examinations, spectacles and contact lens fitting.', services: [['Eye Examination', 12], ['Contact Lens Fitting', 20], ['Prescription Update', 8]] },
  { name: 'Lifeline Diagnostics', category: 'medical', dLat: -0.012, dLng: -0.024, avg: 8, queue: 7, served: 22, street: 'Kidwai Nagar Crossing', phone: '+91 98765 88888', image: img('photo-1581093588401-fbb62a02f120'), hours: ['07:00', '20:00'],
    description: 'Blood tests, X-ray, ECG and ultrasound. Reports the same day.', services: [['Blood Test', 5], ['X-ray', 10], ['ECG', 10], ['Ultrasound', 20]] },
  { name: 'Dr. Mehta Child Clinic', category: 'medical', dLat: 0.045, dLng: 0.012, avg: 10, queue: 4, served: 6, street: 'Arya Nagar', phone: '+91 98765 99999', image: img('photo-1584515933487-779824d29309'), hours: ['10:00', '14:00'],
    description: 'Paediatrician. Vaccinations every morning.', services: [['Consultation', 10], ['Vaccination', 5], ['Growth Check', 8]] },
  { name: 'PetCare Animal Clinic', category: 'medical', dLat: -0.041, dLng: -0.008, avg: 15, queue: 1, served: 3, street: 'Ratanlal Nagar', phone: '+91 98765 12121', image: img('photo-1548767797-d8c844163c4c'),
    description: 'Vet for dogs, cats and birds. Grooming on weekends.', services: [['Vet Consultation', 15], ['Vaccination', 10], ['Grooming', 40]] },
  // --- salon ---
  { name: 'Glow Salon', category: 'salon', dLat: -0.007, dLng: 0.009, avg: 20, queue: 3, served: 5, street: '4 Civil Lines', phone: '+91 98765 22222', image: img('photo-1560066984-138dadb4c035'),
    description: 'Unisex salon — cuts, colour, styling.', services: [['Haircut', 25], ['Beard Trim', 15], ['Hair Colour', 60]] },
  { name: 'Urban Cuts Barbershop', category: 'salon', dLat: 0.016, dLng: 0.028, avg: 15, queue: 6, served: 14, street: 'Tilak Nagar Market', phone: '+91 98765 23232', image: img('photo-1503951914875-452162b0f3f1'), hours: ['08:00', '21:00'],
    description: 'Classic barbershop. Fades, shaves and hot towels.', services: [['Haircut', 15], ['Shave', 10], ['Head Massage', 15]] },
  { name: 'Radiance Beauty Studio', category: 'salon', dLat: -0.022, dLng: 0.018, avg: 35, queue: 2, served: 3, street: 'Govind Nagar', phone: '+91 98765 24242', image: img('photo-1522337660859-02fbefca4702'), hours: ['10:00', '20:00'],
    description: 'Facials, waxing, bridal make-up and hair spa.', services: [['Facial', 40], ['Waxing', 30], ['Hair Spa', 45], ['Threading', 10]] },
  { name: 'Blush Nail Bar', category: 'salon', dLat: 0.009, dLng: -0.019, avg: 30, queue: 0, served: 2, street: 'Z Square Mall, 2nd floor', phone: '+91 98765 25252', image: img('photo-1604654894610-df63bc536371'), open: false, hours: ['11:00', '21:00'],
    description: 'Manicure, pedicure and nail art. Closed on Tuesdays.', services: [['Manicure', 30], ['Pedicure', 40], ['Nail Art', 45]] },
  // --- bank ---
  { name: 'City Bank — Main Branch', category: 'bank', dLat: 0.012, dLng: -0.008, avg: 8, queue: 4, served: 31, street: '88 MG Road', phone: '+91 98765 33333', image: img('photo-1541354329998-f4d9a9f9297f'), hours: ['10:00', '16:00'],
    description: 'Account services, loans and lockers.', services: [['Account Services', 8], ['Loan Enquiry', 15], ['Cash Deposit', 4]] },
  { name: 'Union Trust Bank — Civil Lines', category: 'bank', dLat: -0.003, dLng: 0.022, avg: 7, queue: 8, served: 40, street: 'Civil Lines, near GPO', phone: '+91 98765 34343', image: img('photo-1601597111158-2fceff292cdc'), hours: ['10:00', '16:00'],
    description: 'Savings, KYC updates, demand drafts and forex.', services: [['KYC Update', 10], ['Demand Draft', 6], ['Cheque Deposit', 3], ['Forex', 15]] },
  { name: 'Post Office Savings Bank', category: 'bank', dLat: 0.031, dLng: 0.041, avg: 9, queue: 5, served: 18, street: 'Head Post Office, Bada Chauraha', phone: '+91 98765 35353', image: img('photo-1586769852836-bc069f19e1b6'), hours: ['09:30', '17:00'],
    description: 'Savings accounts, recurring deposits, speed post.', services: [['Passbook Update', 5], ['Speed Post', 4], ['New Account', 20]] },
  // --- government ---
  { name: 'RTO Office', category: 'government', dLat: -0.018, dLng: -0.012, avg: 12, queue: 5, served: 26, street: 'Transport Nagar', phone: '+91 98765 44444', image: img('photo-1450101499163-c8848c66ca85'), hours: ['10:00', '17:00'],
    description: 'Driving licence and vehicle registration counter.', services: [['Licence Renewal', 12], ['Vehicle Registration', 20], ['Address Change', 10]] },
  { name: 'Passport Seva Kendra', category: 'government', dLat: 0.02, dLng: -0.03, avg: 14, queue: 9, served: 35, street: 'Mega Mall, Kalyanpur', phone: '+91 98765 45454', image: img('photo-1554224155-8d04cb21cd6c'), hours: ['09:00', '16:30'],
    description: 'Passport applications, renewals and police verification queries.', services: [['New Passport', 20], ['Renewal', 12], ['Document Verification', 8]] },
  { name: 'Aadhaar Enrolment Centre', category: 'government', dLat: -0.035, dLng: 0.014, avg: 10, queue: 0, served: 15, street: 'Barra Bypass', phone: '+91 98765 46464', image: img('photo-1521791136064-7986c2920216'), open: false, hours: ['10:00', '15:00'],
    description: 'New enrolments and biometric/mobile updates.', services: [['New Enrolment', 15], ['Biometric Update', 10], ['Mobile Number Update', 5]] },
  { name: 'Electricity Bill Counter', category: 'government', dLat: 0.006, dLng: 0.048, avg: 5, queue: 6, served: 44, street: 'Vijay Nagar Sub-station', phone: '+91 98765 47474', image: img('photo-1473341304170-971dccb5ac1e'), hours: ['09:00', '18:00'],
    description: 'Bill payments, new connections and meter complaints.', services: [['Bill Payment', 3], ['New Connection', 15], ['Meter Complaint', 8]] },
  // --- repair ---
  { name: 'FixIt Mobile Repair', category: 'repair', dLat: 0.02, dLng: 0.02, avg: 15, queue: 2, served: 7, street: '21 Station Road', phone: '+91 98765 55555', image: img('photo-1597872200969-2b65d56bd16b'),
    description: 'Phone and laptop repair while you wait.', services: [['Screen Replacement', 30], ['Battery', 20], ['Diagnosis', 10]] },
  { name: 'QuickFix Laptop Service', category: 'repair', dLat: -0.015, dLng: 0.036, avg: 25, queue: 3, served: 4, street: 'Naveen Market', phone: '+91 98765 56565', image: img('photo-1588508065123-287b28e013da'),
    description: 'Laptop, printer and desktop repairs. Data recovery.', services: [['Diagnosis', 15], ['OS Reinstall', 40], ['Keyboard Replacement', 25]] },
  { name: 'AutoCare Bike Service', category: 'repair', dLat: 0.038, dLng: -0.012, avg: 40, queue: 4, served: 6, street: 'GT Road, Panki', phone: '+91 98765 57575', image: img('photo-1558618666-fcd25c85cd64'), hours: ['08:00', '19:00'],
    description: 'Two-wheeler servicing, puncture repair and washing.', services: [['General Service', 45], ['Puncture', 10], ['Wash & Polish', 20]] },
  // --- other ---
  { name: 'Express Laundry & Dry Clean', category: 'other', dLat: -0.026, dLng: -0.03, avg: 4, queue: 2, served: 12, street: 'Shastri Nagar', phone: '+91 98765 61616', image: img('photo-1517677208171-0bc6725a3e60'), hours: ['08:00', '20:00'],
    description: 'Drop-off counter. Same-day service before noon.', services: [['Drop-off', 3], ['Pick-up', 3], ['Express Order', 5]] },
  { name: 'Master Tailors & Alterations', category: 'other', dLat: 0.001, dLng: -0.044, avg: 12, queue: 3, served: 5, street: 'Naughara, Chowk', phone: '+91 98765 62626', image: img('photo-1558618047-3c8c76ca7d13'), hours: ['10:00', '20:00'],
    description: 'Measurements, alterations and school uniforms.', services: [['Measurement', 10], ['Alteration Drop-off', 5], ['Trial', 15]] },
];

const CUSTOMERS = ['Priya', 'Rahul', 'Neha', 'Vikram', 'Sana', 'Kabir', 'Ananya', 'Rohan', 'Isha', 'Arjun', 'Meera', 'Dev', 'Zara', 'Karan', 'Pooja', 'Aditya'];
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

async function upsertUser(name, email, role) {
  return (await User.findOne({ email })) || User.create({ name, email, role, passwordHash: await bcrypt.hash(PASSWORD, 10) });
}

export async function seed() {
  const admin = await upsertUser('Admin', process.env.ADMIN_EMAIL || 'admin@example.com', 'admin');
  const customer = await upsertUser('Aarav Customer', 'user@example.com', 'user');
  const people = await Promise.all(CUSTOMERS.map((n) => upsertUser(n, `${n.toLowerCase()}@example.com`, 'user')));
  const day = new Date().toISOString().slice(0, 10);
  const created = [];
  for (const [i, s] of SHOPS.entries()) {
    if (await Queue.exists({ name: s.name })) continue;
    const vendor = await upsertUser(`${s.name} Owner`, `${slug(s.name)}@example.com`, 'staff');
    const queue = await Queue.create({
      name: s.name, description: s.description, category: s.category, owner: vendor._id, avgServiceMinutes: s.avg, image: s.image,
      isOpen: s.open !== false, phone: s.phone, email: vendor.email,
      address: { street: s.street, city: 'Kanpur', state: 'Uttar Pradesh', pincode: String(208001 + (i % 25)) },
      hours: { open: s.hours?.[0] ?? '09:00', close: s.hours?.[1] ?? '19:00' },
      services: s.services.map(([name, minutes]) => ({ name, minutes })),
      location: { type: 'Point', coordinates: [CENTER.lng + s.dLng, CENTER.lat + s.dLat] },
    });
    // served earlier today (for analytics), then the live line: first one being served, rest waiting
    let counter = 0;
    const now = Date.now();
    for (let k = 0; k < s.served; k++) {
      const createdAt = new Date(now - (s.served - k) * s.avg * 60000 * 1.4 - 30 * 60000);
      const calledAt = new Date(createdAt.getTime() + s.avg * 60000 * (0.6 + (k % 3) * 0.3));
      const t = await Token.create({ queue: queue._id, user: people[(k * 7 + i) % people.length]._id, number: ++counter, service: queue.services[k % queue.services.length].name, status: k % 9 === 8 ? 'skipped' : 'served', calledAt, doneAt: new Date(calledAt.getTime() + s.avg * 60000) });
      await Token.updateOne({ _id: t._id }, { $set: { createdAt } });
    }
    for (let k = 0; k < s.queue; k++) {
      const t = await Token.create({ queue: queue._id, user: people[(k + i * 3) % people.length]._id, number: ++counter, service: queue.services[k % queue.services.length].name, status: k === 0 ? 'serving' : 'waiting', calledAt: k === 0 ? new Date(now - 3 * 60000) : undefined });
      if (k === 0) queue.currentToken = t._id;
    }
    queue.counter = counter;
    queue.counterDate = day;
    await queue.save();
    created.push(queue.name);
  }
  // a couple of appointments for the demo customer
  const at = (hoursFromNow, minute = 0) => { const d = new Date(Date.now() + hoursFromNow * 3600e3); d.setMinutes(minute, 0, 0); return d; };
  const appts = [['Dr. Sharma Clinic', at(3, 30), 'General Consultation', 'Fever since yesterday'], ['Glow Salon', at(26, 0), 'Haircut', '']];
  for (const [shop, when, service, note] of appts) {
    const q = await Queue.findOne({ name: shop });
    if (q && !(await Appointment.exists({ queue: q._id, user: customer._id, status: 'booked' }))) await Appointment.create({ queue: q._id, user: customer._id, at: when, service, note });
  }
  return { admin: admin.email, customer: customer.email, created, total: await Queue.countDocuments() };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const { connectDb } = await import('./src/db.js');
  const stop = await connectDb();
  const out = await seed();
  console.log(`Seeded around ${CENTER.lat}, ${CENTER.lng}. ${out.total} shops in the database (${out.created.length} new).\nLogin with password "${PASSWORD}":\n  admin    ${out.admin}\n  customer ${out.customer}\n  vendors  <shop-name>@example.com (e.g. dr-sharma-clinic@example.com, passport-seva-kendra@example.com)`);
  await stop();
}
