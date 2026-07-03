// backend/routes/clients.js
const express = require('express')
const router  = express.Router()
const db      = require('../db/database')

// GET /api/clients — lista com contagem de pedidos e total gasto (pedidos quitados)
router.get('/', (req, res) => {
  try {
    const q = req.query.q ? `%${req.query.q}%` : '%'
    const clients = db.query(`
      SELECT c.*,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE((
          SELECT SUM(oi.unit_price * oi.quantity)
          FROM order_items oi
          JOIN orders o2 ON o2.id = oi.order_id
          WHERE o2.client_id = c.id AND o2.status = 'Quitado'
        ), 0) as total_spent
      FROM clients c
      LEFT JOIN orders o ON o.client_id = c.id
      WHERE c.name LIKE ?
      GROUP BY c.id
      ORDER BY c.name
    `, [q])
    res.json(clients)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/clients/:id
router.get('/:id', (req, res) => {
  try {
    const client = db.queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id])
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' })
    res.json(client)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/clients/:id/orders — histórico completo: cada pedido com seus itens
router.get('/:id/orders', (req, res) => {
  try {
    const client = db.queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id])
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' })

    const headers = db.query(
      'SELECT * FROM orders WHERE client_id = ? ORDER BY date DESC, id DESC',
      [req.params.id]
    )

    const orders = headers.map(o => {
      const items = db.query(`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
      `, [o.id])
      const total  = Math.round(items.reduce((s, i) => s + i.unit_price * i.quantity, 0) * 100) / 100
      const profit = Math.round(items.reduce((s, i) => s + (i.unit_price - i.unit_cost) * i.quantity, 0) * 100) / 100
      return { ...o, items, total, profit, item_count: items.reduce((s, i) => s + i.quantity, 0) }
    })

    const summary = {
      total_orders:   orders.length,
      paid_orders:    orders.filter(o => o.status === 'Quitado').length,
      open_orders:    orders.filter(o => o.status === 'Em aberto').length,
      total_revenue:  Math.round(orders.filter(o => o.status === 'Quitado').reduce((s, o) => s + o.total, 0) * 100) / 100,
      total_profit:   Math.round(orders.filter(o => o.status === 'Quitado').reduce((s, o) => s + o.profit, 0) * 100) / 100,
    }

    res.json({ client, orders, summary })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/clients
router.post('/', (req, res) => {
  const { name, email, phone, address, notes } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' })
  try {
    db.run(
      'INSERT INTO clients (name, email, phone, address, notes) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email?.trim() || null, phone?.trim() || null, address?.trim() || null, notes?.trim() || null]
    )
    const client = db.queryOne('SELECT * FROM clients WHERE id = ?', [db.lastId()])
    res.status(201).json(client)
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cliente com este nome já existe.' })
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/clients/:id
router.put('/:id', (req, res) => {
  const { name, email, phone, address, notes } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' })
  try {
    db.run(
      'UPDATE clients SET name=?, email=?, phone=?, address=?, notes=? WHERE id=?',
      [name.trim(), email?.trim() || null, phone?.trim() || null, address?.trim() || null, notes?.trim() || null, req.params.id]
    )
    const client = db.queryOne('SELECT * FROM clients WHERE id = ?', [req.params.id])
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' })
    res.json(client)
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Cliente com este nome já existe.' })
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/clients/:id
router.delete('/:id', (req, res) => {
  try {
    const hasOrders = db.queryOne('SELECT id FROM orders WHERE client_id = ? LIMIT 1', [req.params.id])
    if (hasOrders) return res.status(409).json({ error: 'Cliente possui pedidos vinculados.' })
    db.run('DELETE FROM clients WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
