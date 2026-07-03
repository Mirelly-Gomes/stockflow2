const initSqlJs = require('../node_modules/sql.js')
const path = require('path')
const fs   = require('fs')

const DB_PATH = path.join(__dirname, 'stockflow.db')

let _db  = null
let _SQL = null

// Persiste o banco em disco após cada escrita
function persist() {
  const data = _db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

// Executa SQL de escrita, captura o último ID inserido, e persiste
let _lastInsertId = null

function run(sql, params = []) {
  _db.run(sql, params)
  if (/^\s*INSERT/i.test(sql)) {
    const r = queryOne('SELECT last_insert_rowid() as id')
    _lastInsertId = r ? r.id : null
  }
  persist()
}

// Executa query e retorna array de objetos
function query(sql, params = []) {
  const stmt = _db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

// Executa e retorna primeiro resultado ou null
function queryOne(sql, params = []) {
  const rows = query(sql, params)
  return rows[0] ?? null
}

// Retorna o id do último INSERT realizado via run()
function lastId() {
  return _lastInsertId
}

async function init() {
  _SQL = await initSqlJs()

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    _db = new _SQL.Database(fileBuffer)
  } else {
    _db = new _SQL.Database()
  }

  createSchema()
  seedIfEmpty()
}

function createSchema() {
  _db.run(`PRAGMA foreign_keys = ON`)

  _db.run(`CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`)

  _db.run(`CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    category_id INTEGER REFERENCES categories(id),
    cost_price  REAL    NOT NULL DEFAULT 0,
    sale_price  REAL    NOT NULL DEFAULT 0,
    stock       INTEGER NOT NULL DEFAULT 0,
    min_stock   INTEGER NOT NULL DEFAULT 5,
    sold        INTEGER NOT NULL DEFAULT 0
  )`)

  _db.run(`CREATE TABLE IF NOT EXISTS clients (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT NOT NULL UNIQUE,
    email   TEXT,
    phone   TEXT,
    address TEXT,
    notes   TEXT
  )`)

 
  _db.run(`CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id      INTEGER NOT NULL REFERENCES clients(id),
    date           TEXT    NOT NULL DEFAULT (date('now')),
    status         TEXT    NOT NULL DEFAULT 'Em aberto'
                           CHECK(status IN ('Em aberto','Quitado')),
    payment_method TEXT    DEFAULT 'Dinheiro',
    notes          TEXT
  )`)

  _db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id),
    quantity    INTEGER NOT NULL DEFAULT 1,
    unit_price  REAL    NOT NULL,
    unit_cost   REAL    NOT NULL
  )`)

  persist()
}

function seedIfEmpty() {
  const count = queryOne('SELECT COUNT(*) as n FROM categories')
  if (count && count.n > 0) return 


  // Categorias
  const cats = ['Perfumes', 'Maquiagem', 'Corpo e Banho', 'Cuidados Faciais']
  cats.forEach(name => _db.run('INSERT INTO categories (name) VALUES (?)', [name]))

  // Produtos
  const products = [
    ['Kaiak Masculino',                  1, 45.00,  89.90,  2, 5, 20],
    ['Humor Feminino',                   1, 38.00,  79.90, 12, 5, 18],
    ['Tododia Creme Corporal',           3, 15.00,  32.90,  8, 5, 15],
    ['Una Batom',                        2, 22.00,  48.00,  6, 5, 12],
    ['Ekos Sabonete Líquido',            3, 12.00,  28.00,  3, 5, 10],
    ['Tododia Ameixa e Flor de Baunilha',3, 18.00,  39.90,  1, 5,  8],
    ['Ekos Maracujá Sabonete Líquido',   3, 14.00,  31.00,  3, 5,  7],
    ['Renew Sérum',                      4, 55.00, 119.90, 10, 5,  5],
  ]
  products.forEach(([name, cat, cost, sale, stock, min, sold]) => {
    _db.run(
      'INSERT INTO products (name,category_id,cost_price,sale_price,stock,min_stock,sold) VALUES (?,?,?,?,?,?,?)',
      [name, cat, cost, sale, stock, min, sold]
    )
  })

  // Clientes
  const clients = [
    ['Ana Souza',      'ana@email.com',      '(51) 99999-0001', 'Rua das Flores, 123 - Porto Alegre', ''],
    ['Carlos Lima',    'carlos@email.com',   '(51) 99999-0002', 'Av. Central, 456 - Gravataí', ''],
    ['Fernanda Costa', 'fernanda@email.com', '(51) 99999-0003', 'Rua Nova, 789 - Canoas', ''],
    ['João Pereira',   'joao@email.com',     '(51) 99999-0004', 'Travessa Sul, 12 - Caxias do Sul', ''],
  ]
  clients.forEach(([name, email, phone, address, notes]) => {
    _db.run('INSERT INTO clients (name,email,phone,address,notes) VALUES (?,?,?,?,?)', [name, email, phone, address, notes])
  })


  const orders = [
    
    [1, 'Quitado',   'PIX',              '2026-05-10', [[1, 2]]],
    [2, 'Quitado',   'Cartão de Crédito','2026-05-12', [[3, 3]]],
    [3, 'Em aberto', 'Dinheiro',         '2026-05-20', [[2, 1]]],
    [1, 'Quitado',   'PIX',              '2026-05-22', [[5, 2], [6, 1]]],
    [4, 'Em aberto', 'Cartão de Débito', '2026-05-25', [[4, 1]]],
    [2, 'Quitado',   'Dinheiro',         '2026-05-28', [[6, 1]]],
    [3, 'Quitado',   'PIX',              '2026-05-30', [[7, 2]]],
    [4, 'Quitado',   'Cartão de Crédito','2026-06-01', [[8, 1]]],
  ]

  orders.forEach(([clientId, status, payment, date, items]) => {
    _db.run(
      'INSERT INTO orders (client_id, status, payment_method, date, notes) VALUES (?,?,?,?,?)',
      [clientId, status, payment, date, '']
    )
    const orderId = queryOne('SELECT last_insert_rowid() as id').id
    items.forEach(([productId, qty]) => {
      const product = queryOne('SELECT sale_price, cost_price FROM products WHERE id = ?', [productId])
      _db.run(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, unit_cost) VALUES (?,?,?,?,?)',
        [orderId, productId, qty, product.sale_price, product.cost_price]
      )
    })
  })

  persist()
  console.log('Banco com dados iniciais.')
}

module.exports = { init, run, query, queryOne, lastId }
