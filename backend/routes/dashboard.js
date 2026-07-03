// backend/routes/dashboard.js
const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// GET /api/dashboard
router.get('/', (req, res) => {
  try {
    // KPIs principais — soma via order_items, filtrando pelo status do pedido (cabeçalho)
    const kpis = db.queryOne(`
      SELECT
        ROUND(COALESCE(SUM(CASE WHEN o.status='Quitado' THEN oi.unit_price * oi.quantity END), 0), 2) as total_sales,
        ROUND(COALESCE(SUM(CASE WHEN o.status='Quitado' THEN oi.unit_cost  * oi.quantity END), 0), 2) as total_cost,
        (SELECT COUNT(*) FROM orders)                                  as total_orders,
        (SELECT COUNT(*) FROM orders WHERE status='Quitado')           as paid_orders,
        (SELECT COUNT(*) FROM orders WHERE status='Em aberto')         as open_orders,
        (SELECT COUNT(*) FROM products)                                as total_products
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
    `);
    kpis.net_profit = Math.round((kpis.total_sales - kpis.total_cost) * 100) / 100;

    //  5 mais vendidos
    const top5 = db.query(`
      SELECT id, name, sold, stock FROM products
      ORDER BY sold DESC LIMIT 5
    `);

    // Alertas de estoque baixo
    const lowStock = db.query(`
      SELECT id, name, stock, min_stock FROM products
      WHERE stock <= min_stock
      ORDER BY stock ASC LIMIT 5
    `);

    // Lucro por categoria 
    const byCategory = db.query(`
      SELECT
        cat.id,
        cat.name,
        ROUND(COALESCE(SUM((oi.unit_price - oi.unit_cost) * oi.quantity), 0), 2) as profit,
        ROUND(COALESCE(SUM(oi.unit_price * oi.quantity), 0), 2)                  as revenue
      FROM categories cat
      LEFT JOIN products p     ON p.category_id = cat.id
      LEFT JOIN order_items oi ON oi.product_id  = p.id
      LEFT JOIN orders o       ON o.id = oi.order_id AND o.status = 'Quitado'
      GROUP BY cat.id
      ORDER BY profit DESC
    `);

    // Vendas mensais 
    const monthlySales = db.query(`
      SELECT
        strftime('%Y-%m', o.date) as month,
        ROUND(SUM(oi.unit_price * oi.quantity), 2) as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status = 'Quitado'
        AND o.date >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', o.date)
      ORDER BY month ASC
    `);

    res.json({ kpis, top5, lowStock, byCategory, monthlySales });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
