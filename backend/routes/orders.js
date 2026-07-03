// backend/routes/orders.js
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// Recalcula total e lucro de um pedido a partir dos itens
function attachTotals(order) {
  const items = db.query(`
    SELECT oi.*, p.name as product_name
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
  `, [order.id]);
  order.items     = items;
  order.item_count = items.reduce((s, i) => s + i.quantity, 0);
  order.total     = Math.round(items.reduce((s, i) => s + i.unit_price * i.quantity, 0) * 100) / 100;
  order.profit    = Math.round(items.reduce((s, i) => s + (i.unit_price - i.unit_cost) * i.quantity, 0) * 100) / 100;
  return order;
}

// GET /api/orders  — lista cabeçalhos com totais agregados dos itens
router.get('/', (req, res) => {
  try {
    const { q, status } = req.query;
    let sql = `
      SELECT o.*, c.name as client_name
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      WHERE 1=1
    `;
    const params = [];
    if (q) { sql += ' AND c.name LIKE ?'; params.push(`%${q}%`); }
    if (status) { sql += ' AND o.status = ?'; params.push(status); }
    sql += ' ORDER BY o.date DESC, o.id DESC';

    const orders = db.query(sql, params).map(attachTotals);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/orders/:id — detalhe completo de um pedido
router.get('/:id', (req, res) => {
  try {
    const order = db.queryOne(`
      SELECT o.*, c.name as client_name
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      WHERE o.id = ?
    `, [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    res.json(attachTotals(order));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/orders  — cria pedido com 1+ itens
// body: { client_id, status, notes, items: [{ product_id, quantity }] }
router.post('/', (req, res) => {
  const { client_id, status, notes, items } = req.body;
  if (!client_id) return res.status(400).json({ error: 'Cliente é obrigatório.' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Adicione ao menos um item ao pedido.' });
  }

  try {
    // Valida estoque 
    const resolvedItems = [];
    for (const it of items) {
      const qty = parseInt(it.quantity);
      if (!it.product_id || !qty || qty < 1) {
        return res.status(400).json({ error: 'Item de pedido inválido.' });
      }
      const product = db.queryOne('SELECT * FROM products WHERE id = ?', [it.product_id]);
      if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
      if (product.stock < qty) {
        return res.status(409).json({ error: `Estoque insuficiente para "${product.name}". Disponível: ${product.stock} un.` });
      }
      resolvedItems.push({ product, qty });
    }

    // Cria o cabeçalho
    db.run(
      `INSERT INTO orders (client_id, status, notes, date)
       VALUES (?, ?, ?, date('now'))`,
      [client_id, status || 'Em aberto', notes || '']
    );
    const orderId = db.lastId();

    // Cria desconta e soma venda 
    resolvedItems.forEach(({ product, qty }) => {
      db.run(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost) VALUES (?,?,?,?,?)',
        [orderId, product.id, qty, product.sale_price, product.cost_price]
      );
      db.run(
        'UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ?',
        [qty, qty, product.id]
      );
    });

    const order = attachTotals(db.queryOne(`
      SELECT o.*, c.name as client_name FROM orders o
      JOIN clients c ON c.id = o.client_id WHERE o.id = ?
    `, [orderId]));
    res.status(201).json(order);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// quita/reabre pedido
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['Em aberto', 'Quitado'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }
  try {
    const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    const updated = attachTotals(db.queryOne(`
      SELECT o.*, c.name as client_name FROM orders o
      JOIN clients c ON c.id = o.client_id WHERE o.id = ?
    `, [req.params.id]));
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/orders/:id — edita pedido existente (substitui itens e recalcula estoque)
// body: { client_id, status, notes, items: [{ product_id, quantity }] }
router.put('/:id', (req, res) => {
  const { client_id, status, notes, items } = req.body;
  if (!client_id) return res.status(400).json({ error: 'Cliente é obrigatório.' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Adicione ao menos um item ao pedido.' });
  }

  try {
    const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

    // Restaura o estoque dos itens antigos antes de validar os novos
    const oldItems = db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    oldItems.forEach(it => {
      db.run(
        'UPDATE products SET stock = stock + ?, sold = MAX(0, sold - ?) WHERE id = ?',
        [it.quantity, it.quantity, it.product_id]
      );
    });

    // Valida estoque dos novos itens
    const resolvedItems = [];
    for (const it of items) {
      const qty = parseInt(it.quantity);
      if (!it.product_id || !qty || qty < 1) {
        return res.status(400).json({ error: 'Item de pedido inválido.' });
      }
      const product = db.queryOne('SELECT * FROM products WHERE id = ?', [it.product_id]);
      if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
      if (product.stock < qty) {
        return res.status(409).json({ error: `Estoque insuficiente para "${product.name}". Disponível: ${product.stock} un.` });
      }
      resolvedItems.push({ product, qty });
    }

    // Atualiza o cabeçalho do pedido
    db.run(
      'UPDATE orders SET client_id=?, status=?, notes=? WHERE id=?',
      [client_id, status || 'Em aberto', notes || '', req.params.id]
    );

    // Substitui os itens e desconta o novo estoque
    db.run('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
    resolvedItems.forEach(({ product, qty }) => {
      db.run(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost) VALUES (?,?,?,?,?)',
        [req.params.id, product.id, qty, product.sale_price, product.cost_price]
      );
      db.run(
        'UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ?',
        [qty, qty, product.id]
      );
    });

    const updated = attachTotals(db.queryOne(`
      SELECT o.*, c.name as client_name FROM orders o
      JOIN clients c ON c.id = o.client_id WHERE o.id = ?
    `, [req.params.id]));
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/orders/:id — exclui pedido inteiro e restaura estoque de todos os itens
router.delete('/:id', (req, res) => {
  try {
    const order = db.queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

    const items = db.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    items.forEach(it => {
      db.run(
        'UPDATE products SET stock = stock + ?, sold = MAX(0, sold - ?) WHERE id = ?',
        [it.quantity, it.quantity, it.product_id]
      );
    });

    db.run('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
    db.run('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
