const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./db/database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/clients',    require('./routes/clients'));
app.use('/api/orders',     require('./routes/orders'));


app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n StockFlow  em http://localhost:${PORT}`);
    console.log(`📂 Banco de dados: ${path.join(__dirname, 'db', 'stockflow.db')}\n`);
  });
}).catch(err => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});
