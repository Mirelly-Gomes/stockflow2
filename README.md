# StockFlow

Sistema de gestão de estoque, vendas e financeiro para pequenos negócios, com dashboard de indicadores, controle de produtos, categorias, clientes e pedidos.

##  Funcionalidades

- **Dashboard**: KPIs de vendas, custo, lucro líquido, pedidos (quitados/em aberto), produtos mais vendidos, alertas de estoque baixo, lucro por categoria e vendas mensais.
- **Produtos**: cadastro com preço de custo, preço de venda, estoque atual, estoque mínimo e quantidade vendida.
- **Estoque**: controle e ajuste de quantidades, com alerta quando o estoque atinge o mínimo definido.
- **Categorias**: organização dos produtos por categoria.
- **Clientes**: cadastro de clientes (nome, e-mail, telefone, endereço) e histórico de pedidos por cliente.
- **Pedidos**: criação de pedidos com múltiplos itens, forma de pagamento e status (*Em aberto* / *Quitado*).
- **Financeiro**: visão consolidada de receitas, custos e lucro a partir dos pedidos quitados.

##  Arquitetura

Aplicação full-stack simples, com front-end estático servido pelo próprio back-end Node/Express.

```
stockflow2/
├── index.html            # Página principal (shell com sidebar/menu)
├── views/                # Telas (dashboard, produtos, estoque, categorias, clientes, pedidos, financeiro)
├── assets/
│   ├── css/              # Estilos (base, layout, componentes, páginas)
│   └── js/                # api.js (client HTTP) e utils.js
├── controllers/
│   └── controllers.js     # Lógica das telas no front-end
└── backend/
    ├── server.js          # Servidor Express
    ├── package.json
    ├── db/
    │   ├── database.js    # Camada de acesso ao banco (sql.js / SQLite em arquivo)
    │   └── stockflow.db   # Arquivo do banco de dados (SQLite)
    └── routes/
        ├── dashboard.js
        ├── categories.js
        ├── products.js
        ├── clients.js
        └── orders.js
```

### Front-end
HTML, CSS e JavaScript. O `index.html` monta a estrutura com menu lateral e carrega as views correspondentes a cada seção do sistema.

### Back-end
- **Node.js + Express** expondo uma API REST em `/api`.
- **Banco de dados**: SQLite manipulado via `sql.js`, persistido em arquivo (`backend/db/stockflow.db`) a cada escrita.
- Na primeira execução, o schema é criado automaticamente e o banco é populado com dados de exemplo (categorias, produtos, clientes e pedidos), caso esteja vazio.

##  Modelo de dados

| Tabela | Descrição |
|---|---|
| `categories` | Categorias de produtos |
| `products` | Produtos (custo, preço de venda, estoque, estoque mínimo, vendidos) |
| `clients` | Clientes |
| `orders` | Pedidos (cliente, data, status, forma de pagamento) |
| `order_items` | Itens de cada pedido (produto, quantidade, preço e custo unitários) |

##  API

Base: `/api`

| Recurso | Endpoints |
|---|---|
| Dashboard | `GET /dashboard` |
| Categorias | `GET`, `POST /categories` · `PUT`, `DELETE /categories/:id` |
| Produtos | `GET`, `POST /products` · `GET`, `PUT`, `DELETE /products/:id` · `PATCH /products/:id/stock` |
| Clientes | `GET`, `POST /clients` · `GET`, `PUT`, `DELETE /clients/:id` · `GET /clients/:id/orders` |
| Pedidos | `GET`, `POST /orders` · `GET`, `PUT`, `DELETE /orders/:id` · `PATCH /orders/:id/status` |

##  Como executar

Pré-requisitos: [Node.js](https://nodejs.org/) instalado.

```bash
# 1. Entrar na pasta do back-end
cd backend

# 2. Instalar dependências
npm install

# 3. Iniciar o servidor
npm start
# ou, em modo desenvolvimento (reinicia ao salvar alterações)
npm run dev
```

O servidor sobe em `http://localhost:3000` (porta configurável pela variável de ambiente `PORT`) e já serve o front-end junto com a API.

##  Tecnologias

- Node.js, Express
- sql.js (SQLite via WebAssembly)
- CORS
- HTML, CSS , Chart.js  e JavaScript 

##  Observações

- O banco de dados é um arquivo local (`backend/db/stockflow.db`); ao apagá-lo, o sistema recria o schema e os dados de exemplo na próxima inicialização.
- Não há autenticação implementada — recomendado para uso local/demonstração; para produção, avaliar adicionar controle de acesso.
