// assets/js/api.js — StockFlow API Client
// Todos os dados vêm do backend Node.js + SQLite em /api/*

const API_BASE = '/api';

// Wrapper fetch com tratamento de erro
async function apiFetch(url, options = {}) {
  const res = await fetch(API_BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

const API = {
  // Dashboard
  dashboard: {
    get: () => apiFetch('/dashboard'),
  },

  // Categorias
  categories: {
    all:    ()         => apiFetch('/categories'),
    create: (body)     => apiFetch('/categories', { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) => apiFetch(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id)       => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
  },

  // Produtos
  products: {
    all:      (q)      => apiFetch('/products' + (q ? `?q=${encodeURIComponent(q)}` : '')),
    get:      (id)     => apiFetch(`/products/${id}`),
    create:   (body)   => apiFetch('/products', { method: 'POST', body: JSON.stringify(body) }),
    update:   (id, b)  => apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    delete:   (id)     => apiFetch(`/products/${id}`, { method: 'DELETE' }),
    addStock: (id, qty)=> apiFetch(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ qty }) }),
  },

  // Clientes
  clients: {
    all:    (q)    => apiFetch('/clients' + (q ? `?q=${encodeURIComponent(q)}` : '')),
    get:    (id)   => apiFetch(`/clients/${id}`),
    orders: (id)   => apiFetch(`/clients/${id}/orders`),
    create: (body) => apiFetch('/clients', { method: 'POST', body: JSON.stringify(body) }),
    update: (id,b) => apiFetch(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    delete: (id)   => apiFetch(`/clients/${id}`, { method: 'DELETE' }),
  },

  // Orders
  orders: {
    all:          (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiFetch('/orders' + (qs ? `?${qs}` : ''));
    },
    get:          (id)          => apiFetch(`/orders/${id}`),
    create:       (body)        => apiFetch('/orders', { method: 'POST', body: JSON.stringify(body) }),
    update:       (id, body)    => apiFetch(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    setStatus:    (id, status)  => apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    delete:       (id)          => apiFetch(`/orders/${id}`, { method: 'DELETE' }),
  },
};
