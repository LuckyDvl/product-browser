import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static UI assets
app.use(express.static(path.join(__dirname, 'public')));

// 1. Get Categories API
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT category FROM products ORDER BY category ASC');
    const categories = result.rows.map(row => row.category);
    res.json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Database error fetching categories' });
  }
});

// Helper to encode cursors to Base64
function encodeCursor(created_at, id) {
  const jsonStr = JSON.stringify({ created_at, id });
  return Buffer.from(jsonStr).toString('base64');
}

// Helper to decode Base64 cursors
function decodeCursor(cursorStr) {
  try {
    const jsonStr = Buffer.from(cursorStr, 'base64').toString('ascii');
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

// 2. Paginated Products API (Keyset Pagination)
app.get('/api/products', async (req, res) => {
  try {
    const category = req.query.category || null;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const nextCursorStr = req.query.next || null;
    const prevCursorStr = req.query.prev || null;

    let rows = [];
    let hasNext = false;
    let hasPrev = false;

    if (prevCursorStr) {
      // BACKWARD PAGINATION (Prev button clicked)
      const cursor = decodeCursor(prevCursorStr);
      if (!cursor) {
        return res.status(400).json({ success: false, error: 'Invalid prev cursor' });
      }

      let query = `
        SELECT id, name, category, price, created_at, updated_at
        FROM products
        WHERE (created_at > $1 OR (created_at = $1 AND id > $2))
      `;
      let params = [new Date(cursor.created_at), cursor.id];

      if (category) {
        query += ` AND category = $3`;
        params.push(category);
      }

      // Query limit + 1 items ASC to see if there is more data back there
      query += ` ORDER BY created_at ASC, id ASC LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await pool.query(query, params);
      rows = result.rows;

      hasPrev = rows.length > limit;
      if (hasPrev) {
        rows = rows.slice(0, limit);
      }
      
      // Since we query ASC, we reverse the results to maintain DESC order for display
      rows.reverse();
      hasNext = true; // We came from a page, so there is definitely a next page

    } else {
      // FORWARD PAGINATION (Page 1 or Next button clicked)
      const cursor = nextCursorStr ? decodeCursor(nextCursorStr) : null;
      let params = [];
      let whereClauses = [];

      if (cursor) {
        whereClauses.push(`(created_at < $1 OR (created_at = $1 AND id < $2))`);
        params.push(new Date(cursor.created_at), cursor.id);
      }

      if (category) {
        whereClauses.push(`category = $${params.length + 1}`);
        params.push(category);
      }

      let query = `
        SELECT id, name, category, price, created_at, updated_at
        FROM products
      `;

      if (whereClauses.length > 0) {
        query += ` WHERE ` + whereClauses.join(' AND ');
      }

      // Query limit + 1 items DESC to check if there is a next page
      query += ` ORDER BY created_at DESC, id DESC LIMIT $${params.length + 1}`;
      params.push(limit + 1);

      const result = await pool.query(query, params);
      rows = result.rows;

      hasNext = rows.length > limit;
      if (hasNext) {
        rows = rows.slice(0, limit);
      }
      
      hasPrev = !!cursor; // If we used a cursor, a previous page exists
    }

    // Build cursors for the client
    const nextCursor = (hasNext && rows.length > 0) 
      ? encodeCursor(rows[rows.length - 1].created_at, rows[rows.length - 1].id) 
      : null;

    const prevCursor = (hasPrev && rows.length > 0) 
      ? encodeCursor(rows[0].created_at, rows[0].id) 
      : null;

    res.json({
      success: true,
      products: rows,
      next_cursor: nextCursor,
      prev_cursor: prevCursor,
      has_next: hasNext,
      has_prev: hasPrev
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: 'Database error fetching products' });
  }
});

// 3. Simulation Endpoint: Add 50 new products
app.post('/api/products/simulate', async (req, res) => {
  try {
    const category = req.body.category || CATEGORIES_LIST[Math.floor(Math.random() * CATEGORIES_LIST.length)];
    const count = 50;
    const values = [];
    const placeholders = [];
    let valCount = 1;
    const now = new Date();

    console.log(`Simulating insertion of ${count} new products...`);

    const adjectives = ['Live-Update', 'New-Arrival', 'Fresh-Release', 'Trending', 'Hot-Item'];
    const nouns = ['Special', 'Edition', 'Selection', 'Choice', 'Item'];

    for (let i = 0; i < count; i++) {
      const id = randomUUID();
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const noun = nouns[Math.floor(Math.random() * nouns.length)];
      const name = `★ ${adj} ${noun} #${Math.floor(Math.random() * 10000)} ★`;
      const price = parseFloat((Math.random() * 150 + 20).toFixed(2));

      values.push(id, name, category, price, now, now);
      placeholders.push(`($${valCount}, $${valCount + 1}, $${valCount + 2}, $${valCount + 3}, $${valCount + 4}, $${valCount + 5})`);
      valCount += 6;
    }

    const query = `
      INSERT INTO products (id, name, category, price, created_at, updated_at)
      VALUES ${placeholders.join(', ')}
    `;

    await pool.query(query, values);
    console.log('Simulation products inserted.');

    res.json({ success: true, message: `Successfully added 50 new products to category '${category}'!` });
  } catch (error) {
    console.error('Error in simulation endpoint:', error);
    res.status(500).json({ success: false, error: 'Failed to simulate product insertion' });
  }
});

const CATEGORIES_LIST = [
  'Electronics', 'Clothing', 'Home & Kitchen', 'Books', 'Sports',
  'Beauty', 'Automotive', 'Toys', 'Groceries', 'Tools'
];

// Start Server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

export default app;
