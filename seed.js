import { randomUUID } from 'crypto';
import pool from './db.js';

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home & Kitchen',
  'Books',
  'Sports',
  'Beauty',
  'Automotive',
  'Toys',
  'Groceries',
  'Tools'
];

const ADJECTIVES = [
  'Premium', 'Eco-Friendly', 'Smart', 'Wireless', 'Ultra-Durable', 
  'Deluxe', 'Pro-Series', 'Mini', 'Super-Soft', 'Classic', 
  'Modern', 'Active', 'Ergonomic', 'Stylish', 'Compact',
  'Waterproof', 'High-Speed', 'Vintage', 'Pocket', 'Heavy-Duty'
];

const NOUNS = [
  'Gadget', 'Bottle', 'Backpack', 'Charger', 'Headphones', 
  'Speaker', 'Keyboard', 'Mouse', 'Desk Lamp', 'Notebook', 
  'Smartwatch', 'Camera', 'Blender', 'Screwdriver Set', 'Yoga Mat',
  'Wallet', 'Running Shoes', 'Coffee Mug', 'Socks', 'Sunglasses'
];

function generateProduct(index, timestamp) {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  
  const price = parseFloat((Math.random() * 995 + 5).toFixed(2));
  
  return {
    id: randomUUID(),
    name: `${adj} ${noun} #${index + 1}`,
    category,
    price,
    created_at: new Date(timestamp),
    updated_at: new Date(timestamp)
  };
}

async function seed() {
  const startTime = Date.now();
  console.log('Starting product database seeding...');

  const client = await pool.connect();
  try {
    // 1. Create table structure
    console.log('Recreating products table...');
    await client.query('DROP TABLE IF EXISTS products CASCADE');
    await client.query(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);
    console.log('Table structure recreated.');

    // 2. Generate and Insert Data in Batches
    const totalProducts = 200000;
    const batchSize = 2000;          // 2,000 products per batch (12,000 parameters)
    const startMs = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
    const rangeMs = 30 * 24 * 60 * 60 * 1000;

    console.log(`Inserting ${totalProducts} products sequentially in ${totalProducts / batchSize} batches of ${batchSize}...`);
    
    for (let i = 0; i < totalProducts; i += batchSize) {
      const values = [];
      const placeholders = [];
      let valCount = 1;

      for (let j = 0; j < batchSize && (i + j) < totalProducts; j++) {
        const index = i + j;
        const timestamp = startMs + Math.floor((index / totalProducts) * rangeMs);
        const prod = generateProduct(index, timestamp);

        values.push(prod.id, prod.name, prod.category, prod.price, prod.created_at, prod.updated_at);
        placeholders.push(`($${valCount}, $${valCount + 1}, $${valCount + 2}, $${valCount + 3}, $${valCount + 4}, $${valCount + 5})`);
        valCount += 6;
      }

      const query = `
        INSERT INTO products (id, name, category, price, created_at, updated_at)
        VALUES ${placeholders.join(', ')}
      `;

      await client.query(query, values);
      
      if ((i + batchSize) % 20000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  Seeded ${i + batchSize} / ${totalProducts} products... (${elapsed}s elapsed)`);
      }
    }

    console.log('All products inserted successfully.');

    // 3. Create indexes at the end (orders of magnitude faster)
    console.log('Creating database indexes for pagination performance...');
    await client.query('CREATE INDEX idx_products_pagination ON products (created_at DESC, id DESC)');
    await client.query('CREATE INDEX idx_products_category_pagination ON products (category, created_at DESC, id DESC)');
    console.log('Indexes created.');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Seeding completed successfully in ${duration} seconds!`);
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
