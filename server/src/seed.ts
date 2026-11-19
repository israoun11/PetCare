import 'dotenv/config';
import bcrypt from 'bcryptjs'; import mongoose from 'mongoose';
import { User, Pet, Health, CareTask, Listing, Post, Product } from './models';
(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/petcare');
  await Promise.all([
  User.deleteMany({}),
  Pet.deleteMany({}),
  Health.deleteMany({}),
  CareTask.deleteMany({}),
  Listing.deleteMany({}),
  Post.deleteMany({}),
  Product.deleteMany({})
]);
  const pw = await bcrypt.hash('Demo1234!', 12); // LOCAL DEVELOPMENT ONLY
  const [admin, sarah, omar] = await User.create([{ name: 'PETCARE Admin', email: 'admin@petcare.local', password: pw, role: 'admin' },
    { name: 'Sarah', email: 'sarah@petcare.local', password: pw }, { name: 'Omar', email: 'omar@petcare.local', password: pw }]);
  const day = (n: number, h = 9) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };
  const [luna, milo] = await Pet.create([{ owner: sarah.id, name: 'Luna', species: 'Dog', breed: 'Border Collie', gender: 'Female', birthDate: new Date('2021-04-12'), weight: 17, color: 'Black & white', photo: 'https://placedog.net/600/600?id=12' },
    { owner: sarah.id, name: 'Milo', species: 'Cat', breed: 'British Shorthair', gender: 'Male', birthDate: new Date('2022-09-01'), weight: 5.2, color: 'Grey' }]);
  await Health.create([{ owner: sarah.id, pet: luna.id, kind: 'vaccination', title: 'Rabies', date: day(-300), nextDate: day(65), vet: 'Dr. Ben Salah' },
    { owner: sarah.id, pet: luna.id, kind: 'appointment', title: 'Annual check-up', date: day(6, 10), clinic: 'Happy Paws Clinic', status: 'scheduled' },
    ...[15.8, 16.4, 17].map((v, i) => ({ owner: sarah.id, pet: luna.id, kind: 'weight' as const, title: 'Weight', value: v, date: day(-60 + i * 30) })),
    { owner: sarah.id, pet: milo.id, kind: 'medical', title: 'Dental cleaning', date: day(-40), notes: 'No issues noted.' }]);
  await CareTask.create([{ owner: sarah.id, pet: luna.id, title: 'Morning walk', category: 'Walking', dueAt: day(0, 8), repeat: 'daily' },
    { owner: sarah.id, pet: milo.id, title: 'Dinner', category: 'Feeding', dueAt: day(0, 19), repeat: 'daily' }, { owner: sarah.id, pet: luna.id, title: 'Brush coat', category: 'Grooming', dueAt: day(2), repeat: 'weekly' }]);
  await Listing.create([{ owner: omar.id, name: 'Rex', species: 'Dog', breed: 'Labrador mix', age: 3, gender: 'Male', location: 'Tunis', contact: 'omar@petcare.local', description: 'Gentle and playful.', photo: 'https://placedog.net/600/400?id=22', status: 'approved' },
    { owner: omar.id, name: 'Nala', species: 'Cat', breed: 'Tabby', age: 1, gender: 'Female', location: 'Sfax', contact: 'omar@petcare.local', description: 'Curious and cuddly.', status: 'approved' },
    { owner: omar.id, name: 'Pico', species: 'Rabbit', age: 2, gender: 'Male', location: 'Gabès', contact: 'omar@petcare.local', status: 'pending' }]);
  await Post.create([{ owner: sarah.id, type: 'Story', caption: 'Luna met the sea for the first time today!', petName: 'Luna', photo: 'https://placedog.net/600/400?id=31' },
    { owner: omar.id, type: 'Question', caption: 'Any tips for helping a shy cat settle into a new home?' }]);
  const P = (name: string, category: string, price: number, stock: number, description: string, photo?: string) => ({ name, category, price, stock, description, photo });
  await Product.create([P('Grain-free Kibble 2kg', 'Pet Food', 28, 40, 'Everyday dry food.'), P('Rope Tug Toy', 'Toys', 9.5, 100, 'Durable cotton rope.'),
    P('Adjustable Leather Collar', 'Accessories', 18, 30, 'Soft, strong, adjustable.'), P('Detangling Brush', 'Grooming', 12, 50, 'Gentle on coats.'),
    P('Orthopedic Bed', 'Beds and Furniture', 64, 12, 'Memory foam, washable cover.'), P('Training Treats', 'Training Products', 7, 80, 'Small, low-calorie rewards.'), P('Paw Balm', 'Health and Hygiene', 11, 25, 'Moisturising balm.')]);
  console.log('Seeded. Admin: admin@petcare.local / Demo1234!  User: sarah@petcare.local / Demo1234!'); void admin; await mongoose.disconnect();
})();
