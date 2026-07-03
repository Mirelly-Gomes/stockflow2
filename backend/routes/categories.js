// backend/routes/categories.js
const express = require('express')
const router  = express.Router()
const db      = require('../db/database')

// GET /api/categories
router.get('/', (req, res) => {
  try {
    const cats = db.query(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `)
    res.json(cats)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/categories
router.post('/', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' })
  try {
    db.run('INSERT INTO categories (name) VALUES (?)', [name.trim()])
    const cat = db.queryOne('SELECT * FROM categories WHERE id = ?', [db.lastId()])
    res.status(201).json(cat)
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Categoria já existe.' })
    res.status(500).json({ error: e.message })
  }
})

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Nome é obrigatório.' })
  try {
    db.run('UPDATE categories SET name = ? WHERE id = ?', [name.trim(), req.params.id])
    const cat = db.queryOne('SELECT * FROM categories WHERE id = ?', [req.params.id])
    if (!cat) return res.status(404).json({ error: 'Categoria não encontrada.' })
    res.json(cat)
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Categoria já existe.' })
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  try {
    const inUse = db.queryOne('SELECT id FROM products WHERE category_id = ? LIMIT 1', [req.params.id])
    if (inUse) return res.status(409).json({ error: 'Categoria possui produtos vinculados.' })
    db.run('DELETE FROM categories WHERE id = ?', [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
