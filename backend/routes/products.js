// backend/routes/products.js
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// GET /api/products
router.get('/', (req, res) => {
  try {
    const q = req.query.q ? `%${req.query.q}%` : '%';
    const products = db.query(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.name LIKE ?
      ORDER BY p.name
    `, [q]);
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  try {
    const product = db.queryOne(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/products
router.post('/', (req, res) => {
  const { name, category_id, cost_price, sale_price, stock, min_stock } = req.body;
  if (!name?.trim())    return res.status(400).json({ error: 'Nome é obrigatório.' });
  if (cost_price == null) return res.status(400).json({ error: 'Preço de custo é obrigatório.' });
  if (sale_price == null) return res.status(400).json({ error: 'Preço de venda é obrigatório.' });
  try {
    db.run(
      `INSERT INTO products (name, category_id, cost_price, sale_price, stock, min_stock, sold)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [name.trim(), category_id || null, cost_price, sale_price, stock ?? 0, min_stock ?? 5]
    );
    const product = db.queryOne(`
      SELECT p.*, c.name as category_name FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `, [db.lastId()]);
    res.status(201).json(product);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Produto com este nome já existe.' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  const { name, category_id, cost_price, sale_price, stock, min_stock } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' });
  try {
    db.run(
      `UPDATE products SET name=?, category_id=?, cost_price=?, sale_price=?, stock=?, min_stock=?
       WHERE id=?`,
      [name.trim(), category_id || null, cost_price, sale_price, stock ?? 0, min_stock ?? 5, req.params.id]
    );
    const product = db.queryOne(`
      SELECT p.*, c.name as category_name FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(product);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Produto com este nome já existe.' });
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', (req, res) => {
  try {
    db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/products/:id/stock  — entrada de estoque
router.patch('/:id/stock', (req, res) => {
  const qty = parseInt(req.body.qty);
  if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantidade inválida.' });
  try {
    db.run('UPDATE products SET stock = stock + ? WHERE id = ?', [qty, req.params.id]);
    const product = db.queryOne('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
