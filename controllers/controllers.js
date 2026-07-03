
const Controllers = {};

// DASHBOARD 
Controllers.dashboard = {
  charts: {},
  async render() {
    let data;
    try { data = await API.dashboard.get(); }
    catch (e) { Toast.show('Erro ao carregar dashboard: ' + e.message, 'error'); return; }

    const { kpis, top5, lowStock, byCategory, monthlySales } = data;

    document.getElementById('kpi-sales').textContent  = fmt.brl(kpis.total_sales);
    document.getElementById('kpi-profit').textContent = fmt.brl(kpis.net_profit);
    document.getElementById('kpi-orders').textContent = kpis.total_orders;
    document.getElementById('kpi-stock').textContent  = kpis.total_products;

    document.getElementById('top5').innerHTML = top5.length ? top5.map((p, i) =>
      `<li class="top5-list-item">
        <span class="top5-rank">${i+1}</span>
        <span class="top5-name">${p.name}</span>
        <span class="top5-qty">${p.sold||0}</span>
      </li>`
    ).join('') : '<li style="color:var(--text-secondary);padding:8px 0">Sem dados</li>';

    document.getElementById('alerts').innerHTML = lowStock.length ? lowStock.map(p =>
      `<div class="alert-item">
        <span class="alert-icon">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </span>
        <div class="alert-name">${p.name}<div class="alert-sub">Estoque atual</div></div>
        <span class="alert-qty">${p.stock} un.</span>
      </div>`
    ).join('') : '<p style="color:var(--text-secondary);font-size:.88rem;">Nenhum alerta.</p>';

    this._donutStatus(kpis.paid_orders, kpis.open_orders);
    this._donutCategory(byCategory);
    this._lineChart(monthlySales);
  },

  _donutStatus(quitado, emAberto) {
    const ctx = document.getElementById('chart-status')?.getContext('2d');
    if (!ctx) return;
    if (this.charts.status) this.charts.status.destroy();
    this.charts.status = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Quitados', 'Em aberto'],
        datasets: [{ data: [quitado, emAberto], backgroundColor: ['#3B82F6','#D4893A'], borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        cutout: '68%', plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw}` } }
        }
      }
    });
    const total = quitado + emAberto || 1;
    document.getElementById('status-legend').innerHTML = `
      <div class="legend-item"><span class="legend-dot" style="background:#3B82F6"></span><span class="legend-name">Quitados</span><span class="legend-val">${Math.round(quitado/total*100)}% (${quitado})</span></div>
      <div class="legend-item"><span class="legend-dot" style="background:#D4893A"></span><span class="legend-name">Em aberto</span><span class="legend-val">${Math.round(emAberto/total*100)}% (${emAberto})</span></div>`;
  },

  _donutCategory(byCategory) {
    const ctx = document.getElementById('chart-category')?.getContext('2d');
    if (!ctx) return;
    const catColors = ['#E04040','#3B82F6','#4CAF7D','#9B59B6','#F39C12','#1ABC9C'];
    const labels = byCategory.map(c => c.name);
    const data   = byCategory.map(c => c.profit);
    const total  = data.reduce((s, v) => s + v, 0) || 1;
    if (this.charts.category) this.charts.category.destroy();
    this.charts.category = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: catColors.slice(0, byCategory.length), borderWidth: 0, hoverOffset: 4 }] },
      options: { cutout: '65%', plugins: { legend: { display: false } } }
    });
    document.getElementById('category-legend').innerHTML = byCategory.map((c, i) =>
      `<div class="legend-item">
        <span class="legend-dot" style="background:${catColors[i]}"></span>
        <span class="legend-name">${c.name}</span>
        <span class="legend-val">${fmt.brl(c.profit)}</span>
        <span class="legend-pct">${Math.round(c.profit/total*100)}%</span>
      </div>`
    ).join('');
  },

  _lineChart(monthlySales) {
    const ctx = document.getElementById('chart-sales')?.getContext('2d');
    if (!ctx) return;

    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
      const found = monthlySales.find(m => m.month === key);
      months.push({ label: label.charAt(0).toUpperCase() + label.slice(1), value: found ? found.revenue : 0 });
    }

    if (this.charts.sales) this.charts.sales.destroy();
    this.charts.sales = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months.map(m => m.label),
        datasets: [{
          data: months.map(m => m.value), fill: true,
          backgroundColor: 'rgba(27,58,45,.08)',
          borderColor: '#1B3A2D', borderWidth: 2.5,
          pointBackgroundColor: '#D4893A', pointRadius: 5, pointHoverRadius: 7,
          tension: .35
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12 } } },
          y: { beginAtZero: true, grid: { color: '#F0EDE5' }, ticks: { callback: v => `R$${v}`, font: { size: 11 } } }
        }
      }
    });
  }
}

// PRODUTOS 
Controllers.produtos = {
  q: '',
  _cats: [],
  async render() {
    let prods;
    try {
      [prods, this._cats] = await Promise.all([API.products.all(this.q), API.categories.all()]);
    } catch (e) { Toast.show('Erro ao carregar produtos: ' + e.message, 'error'); return; }

    const tbody = document.getElementById('produtos-tbody');
    tbody.innerHTML = prods.length ? prods.map(p => {
      const stockClass = p.stock <= p.min_stock ? 'stock-low' : 'stock-ok';
      return `<tr>
        <td>${p.name}</td>
        <td>${p.category_name || '—'}</td>
        <td>${fmt.brl(p.cost_price)}</td>
        <td>${fmt.brl(p.sale_price)}</td>
        <td class="${stockClass}">${p.stock} un.</td>
        <td>${p.sold || 0}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="Controllers.produtos.edit(${p.id})">Editar</button>
            <button class="btn btn-danger btn-sm"  onclick="Controllers.produtos.del(${p.id})">Excluir</button>
          </div>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="7"><div class="empty-state"><p>Nenhum produto encontrado.</p></div></td></tr>`;
  },
  _form(p = {}) {
    return `<form id="prod-form">
      <div class="form-grid">
        <div class="form-group full"><label>Nome do produto *</label>
          <input name="name" required value="${p.name||''}"></div>
        <div class="form-group"><label>Categoria</label>
          <select name="category_id">
            <option value="">Selecione...</option>
            ${this._cats.map(c => `<option value="${c.id}" ${p.category_id==c.id?'selected':''}>${c.name}</option>`).join('')}
          </select></div>
        <div class="form-group"><label>Preço de custo (R$) *</label>
          <input name="cost_price" type="number" step=".01" min="0" required value="${p.cost_price ?? ''}"></div>
        <div class="form-group"><label>Preço de venda (R$) *</label>
          <input name="sale_price" type="number" step=".01" min="0" required value="${p.sale_price ?? ''}"></div>
        <div class="form-group"><label>Estoque inicial</label>
          <input name="stock" type="number" min="0" value="${p.stock ?? 0}"></div>
        <div class="form-group"><label>Estoque mínimo</label>
          <input name="min_stock" type="number" min="0" value="${p.min_stock ?? 5}"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">${p.id ? 'Salvar' : 'Cadastrar'}</button>
      </div>
    </form>`;
  },
  async new() {
    await this._loadCats();
    Modal.open('Novo Produto', this._form(), async (fd) => {
      try {
        await API.products.create({
          name: fd.get('name').trim(),
          category_id: parseInt(fd.get('category_id')) || null,
          cost_price: parseFloat(fd.get('cost_price')),
          sale_price: parseFloat(fd.get('sale_price')),
          stock: parseInt(fd.get('stock')) || 0,
          min_stock: parseInt(fd.get('min_stock')) || 5,
        });
        Modal.close(); this.render(); Toast.show('Produto cadastrado!');
      } catch(e) { Toast.show(e.message, 'error'); }
    });
  },
  async edit(id) {
    await this._loadCats();
    const p = await API.products.get(id);
    Modal.open('Editar Produto', this._form(p), async (fd) => {
      try {
        await API.products.update(id, {
          name: fd.get('name').trim(),
          category_id: parseInt(fd.get('category_id')) || null,
          cost_price: parseFloat(fd.get('cost_price')),
          sale_price: parseFloat(fd.get('sale_price')),
          stock: parseInt(fd.get('stock')) || 0,
          min_stock: parseInt(fd.get('min_stock')) || 5,
        });
        Modal.close(); this.render(); Toast.show('Produto atualizado!');
      } catch(e) { Toast.show(e.message, 'error'); }
    });
  },
  async _loadCats() { this._cats = await API.categories.all(); },
  del(id) {
    confirmAction(`Excluir este produto? Esta ação não pode ser desfeita.`, async () => {
      try { await API.products.delete(id); this.render(); Toast.show('Produto excluído.'); }
      catch(e) { Toast.show(e.message, 'error'); }
    });
  }
}

// CATEGORIAS 
Controllers.categorias = {
  async render() {
    let cats;
    try { cats = await API.categories.all(); }
    catch (e) { Toast.show('Erro ao carregar categorias: ' + e.message, 'error'); return; }

    const tbody = document.getElementById('cats-tbody');
    tbody.innerHTML = cats.length ? cats.map(c => `<tr>
        <td>${c.name}</td>
        <td>${c.product_count} produto${c.product_count !== 1 ? 's' : ''}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="Controllers.categorias.edit(${c.id})">Editar</button>
            <button class="btn btn-danger btn-sm"  onclick="Controllers.categorias.del(${c.id})">Excluir</button>
          </div>
        </td>
      </tr>`).join('') : `<tr><td colspan="3"><div class="empty-state"><p>Nenhuma categoria cadastrada.</p></div></td></tr>`;
  },
  _form(c = {}) {
    return `<form id="cat-form">
      <div class="form-group full"><label>Nome da categoria *</label>
        <input name="name" required value="${c.name||''}"></div>
      <div class="form-actions" style="margin-top:16px">
        <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">${c.id ? 'Salvar' : 'Cadastrar'}</button>
      </div>
    </form>`;
  },
  new() {
    Modal.open('Nova Categoria', this._form(), async (fd) => {
      try {
        await API.categories.create({ name: fd.get('name').trim() });
        Modal.close(); this.render(); Toast.show('Categoria cadastrada!');
      } catch(e) { Toast.show(e.message, 'error'); }
    });
  },
  edit(id) {
    API.categories.all().then(cats => {
      const c = cats.find(x => x.id === id);
      Modal.open('Editar Categoria', this._form(c), async (fd) => {
        try {
          await API.categories.update(id, { name: fd.get('name').trim() });
          Modal.close(); this.render(); Toast.show('Categoria atualizada!');
        } catch(e) { Toast.show(e.message, 'error'); }
      });
    });
  },
  del(id) {
    confirmAction(`Excluir esta categoria?`, async () => {
      try { await API.categories.delete(id); this.render(); Toast.show('Categoria excluída.'); }
      catch(e) { Toast.show(e.message, 'error'); }
    });
  }
}

// ESTOQUE 
Controllers.estoque = {
  q: '',
  async render() {
    let prods;
    try { prods = await API.products.all(this.q); }
    catch (e) { Toast.show('Erro ao carregar estoque: ' + e.message, 'error'); return; }

    const tbody = document.getElementById('stock-tbody');
    tbody.innerHTML = prods.length ? prods.map(p => {
      const low = p.stock <= p.min_stock;
      return `<tr>
        <td>${p.name}</td>
        <td class="${low ? 'stock-low' : 'stock-ok'}">${p.stock}</td>
        <td>${p.min_stock}</td>
        <td>${low ? '<span class="badge badge-red">Baixo</span>' : '<span class="badge badge-green">OK</span>'}</td>
        <td><button class="btn btn-outline btn-sm" onclick="Controllers.estoque.addStock(${p.id})">+ Entrada</button></td>
      </tr>`;
    }).join('') : `<tr><td colspan="5"><div class="empty-state"><p>Nenhum produto.</p></div></td></tr>`;
  },
  async addStock(id) {
    const p = await API.products.get(id);
    Modal.open(`Entrada de Estoque — ${p.name}`,
      `<form id="stock-form">
        <div class="form-group full"><label>Quantidade a adicionar *</label>
          <input name="qty" type="number" min="1" required value="1"></div>
        <div class="form-actions" style="margin-top:16px">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Confirmar</button>
        </div>
      </form>`, async (fd) => {
        try {
          const updated = await API.products.addStock(id, parseInt(fd.get('qty')));
          Modal.close(); this.render(); Toast.show(`Estoque atualizado para ${updated.stock} unidades.`);
        } catch(e) { Toast.show(e.message, 'error'); }
      });
  }
}

// CLIENTES 
Controllers.clientes = {
  q: '',
  async render() {
    let clients;
    try { clients = await API.clients.all(this.q); }
    catch (e) { Toast.show('Erro ao carregar clientes: ' + e.message, 'error'); return; }

    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = clients.length ? clients.map(c => `<tr>
        <td>${c.name}</td>
        <td>${c.order_count}</td>
        <td>${fmt.brl(c.total_spent)}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="Controllers.clientes.viewHistory(${c.id})">Pedidos</button>
            <button class="btn btn-outline btn-sm" onclick="Controllers.clientes.edit(${c.id})">Editar</button>
            <button class="btn btn-danger btn-sm"  onclick="Controllers.clientes.del(${c.id})">Excluir</button>
          </div>
        </td>
      </tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><p>Nenhum cliente encontrado.</p></div></td></tr>`;
  },
  _form(c = {}) {
    return `<form id="client-form">
      <div class="form-grid">
        <div class="form-group full"><label>Nome Completo *</label>
          <input name="name" required placeholder="Ex: João Silva" value="${c.name||''}"></div>
        <div class="form-group full"><label>Observações</label>
          <textarea name="notes" rows="2" placeholder="Observações sobre o cliente...">${c.notes||''}</textarea></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
        <button type="submit" class="btn btn-primary">${c.id ? 'Salvar' : 'Cadastrar'}</button>
      </div>
    </form>`;
  },
  new() {
    Modal.open('Novo Cliente', this._form(), async (fd) => {
      try {
        await API.clients.create({
          name: fd.get('name').trim(),
          notes: fd.get('notes').trim()
        });
        Modal.close(); this.render(); Toast.show('Cliente cadastrado!');
      } catch(e) { Toast.show(e.message, 'error'); }
    });
  },
  async edit(id) {
    const c = await API.clients.get(id);
    Modal.open('Editar Cliente', this._form(c), async (fd) => {
      try {
        await API.clients.update(id, {
          name: fd.get('name').trim(),
          notes: fd.get('notes').trim()
        });
        Modal.close(); this.render(); Toast.show('Cliente atualizado!');
      } catch(e) { Toast.show(e.message, 'error'); }
    });
  },
  del(id) {
    confirmAction(`Excluir este cliente?`, async () => {
      try { await API.clients.delete(id); this.render(); Toast.show('Cliente excluído.'); }
      catch(e) { Toast.show(e.message, 'error'); }
    });
  },

  // Pedidos do cliente
  async viewHistory(id) {
    let data;
    try { data = await API.clients.orders(id); }
    catch (e) { Toast.show('Erro ao carregar pedidos: ' + e.message, 'error'); return; }

    const { client, orders, summary } = data;

    const ordersHTML = orders.length ? orders.map(o => {
      const badge = o.status === 'Quitado' ? 'badge-green' : 'badge-orange';
      const itemsHTML = o.items.map(it =>
        `<div style="display:flex;justify-content:space-between;font-size:.85rem;padding:4px 0">
          <span>${it.quantity}x ${it.product_name}</span>
          <span style="color:var(--text-secondary)">${fmt.brl(it.unit_price * it.quantity)}</span>
        </div>`
      ).join('');
      return `<div class="card" style="padding:16px;margin-bottom:12px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <strong>Pedido #${o.id}</strong>
            <span style="color:var(--text-secondary);font-size:.82rem;margin-left:8px">${fmt.date(o.date)}</span>
          </div>
          <span class="badge ${badge}">${o.status}</span>
        </div>
        <div style="border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:8px 0;margin-bottom:8px">
          ${itemsHTML}
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700">
          <span>Total (${o.item_count} ${o.item_count === 1 ? 'item' : 'itens'})</span>
          <span>${fmt.brl(o.total)}</span>
        </div>
        ${o.notes ? `<div style="font-size:.8rem;color:var(--text-secondary);margin-top:6px">Obs: ${o.notes}</div>` : ''}
      </div>`;
    }).join('') : `<div class="empty-state"><p>Este cliente ainda não fez pedidos.</p></div>`;

    const bodyHTML = `
      <div class="client-summary-grid">
        <div class="client-summary-card">
          <div class="client-summary-label">Total de Pedidos</div>
          <div class="client-summary-value">${summary.total_orders}</div>
        </div>
        <div class="client-summary-card">
          <div class="client-summary-label">Quitados / Em aberto</div>
          <div class="client-summary-value">${summary.paid_orders} / ${summary.open_orders}</div>
        </div>
        <div class="client-summary-card">
          <div class="client-summary-label">Total Gasto</div>
          <div class="client-summary-value">${fmt.brl(summary.total_revenue)}</div>
        </div>
        <div class="client-summary-card">
          <div class="client-summary-label">Lucro Gerado</div>
          <div class="client-summary-value" style="color:var(--green-light)">${fmt.brl(summary.total_profit)}</div>
        </div>
      </div>
      <div style="max-height:420px;overflow-y:auto;padding-right:4px">${ordersHTML}</div>
      <div class="form-actions">
        <button type="button" class="btn btn-outline" onclick="Modal.close()">Fechar</button>
      </div>
    `;

    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = `Pedidos de ${client.name}`;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    overlay.querySelector('.modal').classList.add('modal-lg');
    overlay.classList.add('open');
  }
}

// PEDIDOS 
Controllers.pedidos = {
  q: '',
  filterStatus: '',
  _cart: [],        // itens do pedido sendo montado no modal: [{product_id, name, qty, unit_price, unit_cost, stock}]
  _products: [],     // cache de produtos para lookup rápido ao adicionar item
  _editingId: null,  // id do pedido em edição (null = novo pedido)

  async render() {
    let orders;
    try { orders = await API.orders.all({ q: this.q, status: this.filterStatus }); }
    catch (e) { Toast.show('Erro ao carregar pedidos: ' + e.message, 'error'); return; }

    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = orders.length ? orders.map(o => {
      const badge = o.status === 'Quitado' ? 'badge-green' : 'badge-orange';
      return `<tr>
        <td>#${o.id}</td>
        <td>${o.client_name}</td>
        <td>${o.item_count} ${o.item_count === 1 ? 'item' : 'itens'}</td>
        <td>${fmt.brl(o.total)}</td>
        <td style="color:var(--green-light);font-weight:600">${fmt.brl(o.profit)}</td>
        <td><span class="badge ${badge}">${o.status}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="Controllers.pedidos.edit(${o.id})">Editar</button>
            <button class="btn btn-outline btn-sm" onclick="Controllers.pedidos.toggleStatus(${o.id}, '${o.status}')">${o.status === 'Quitado' ? 'Reabrir' : 'Quitar'}</button>
            <button class="btn btn-danger btn-sm"  onclick="Controllers.pedidos.del(${o.id})">Excluir</button>
          </div>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="7"><div class="empty-state"><p>Nenhum pedido encontrado.</p></div></td></tr>`;
  },

  //Modal de novo pedido (multi-item)
  async new() {
    this._cart = [];
    this._editingId = null;
    const [clients, products] = await Promise.all([API.clients.all(), API.products.all()]);
    this._products = products;

    document.getElementById('ped-cliente').innerHTML =
      `<option value="">Selecione...</option>` +
      clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    document.getElementById('ped-produto').innerHTML =
      `<option value="">Selecione...</option>` +
      products.map(p => `<option value="${p.id}">${p.name} (Estoque: ${p.stock})</option>`).join('');

    document.getElementById('ped-status').value = 'Em aberto';
    document.getElementById('ped-obs').value = '';
    document.getElementById('ped-qtd-item').value = 1;

    document.getElementById('ped-btn-excluir').style.display = 'none';

    this._renderCart();
    document.getElementById('modal-pedido-title').textContent = 'Novo Pedido';
    document.getElementById('modal-pedido-overlay').classList.add('open');
  },

  // Carrega um pedido existente no modal para edição
  async edit(id) {
    let order;
    try { order = await API.orders.get(id); }
    catch (e) { Toast.show('Erro ao carregar pedido: ' + e.message, 'error'); return; }

    const [clients, products] = await Promise.all([API.clients.all(), API.products.all()]);
    this._products = products;
    this._editingId = id;

    document.getElementById('ped-cliente').innerHTML =
      `<option value="">Selecione...</option>` +
      clients.map(c => `<option value="${c.id}" ${c.id === order.client_id ? 'selected' : ''}>${c.name}</option>`).join('');

    document.getElementById('ped-produto').innerHTML =
      `<option value="">Selecione...</option>` +
      products.map(p => `<option value="${p.id}">${p.name} (Estoque: ${p.stock})</option>`).join('');

    document.getElementById('ped-status').value = order.status;
    document.getElementById('ped-obs').value = order.notes || '';
    document.getElementById('ped-qtd-item').value = 1;

    // Recarrega o carrinho com os itens já salvos no pedido
    this._cart = order.items.map(it => ({
      product_id: it.product_id,
      name: it.product_name,
      qty: it.quantity,
      unit_price: it.unit_price,
      unit_cost: it.unit_cost,
    }));

    document.getElementById('ped-btn-excluir').style.display = 'inline-flex';

    this._renderCart();
    document.getElementById('modal-pedido-title').textContent = `Editar Pedido #${order.id}`;
    document.getElementById('modal-pedido-overlay').classList.add('open');
  },

  closeModal() {
    document.getElementById('modal-pedido-overlay').classList.remove('open');
  },

  // Adiciona o produto selecionado ao carrinho do pedido
  addItem() {
    const productId = parseInt(document.getElementById('ped-produto').value);
    const qty       = parseInt(document.getElementById('ped-qtd-item').value);

    if (!productId) { Toast.show('Selecione um produto.', 'error'); return; }
    if (!qty || qty < 1) { Toast.show('Quantidade inválida.', 'error'); return; }

    const product = this._products.find(p => p.id === productId);
    if (!product) return;

    // Soma se o produto já estiver no carrinho
    const existing = this._cart.find(i => i.product_id === productId);
    const qtyInCart = existing ? existing.qty : 0;

    if (qtyInCart + qty > product.stock) {
      Toast.show(`Estoque insuficiente. Disponível: ${product.stock} un.`, 'error');
      return;
    }

    if (existing) {
      existing.qty += qty;
    } else {
      this._cart.push({
        product_id: product.id,
        name: product.name,
        qty,
        unit_price: product.sale_price,
        unit_cost: product.cost_price,
        stock: product.stock,
      });
    }

    document.getElementById('ped-qtd-item').value = 1;
    this._renderCart();
  },

  removeItem(productId) {
    this._cart = this._cart.filter(i => i.product_id !== productId);
    this._renderCart();
  },

  _renderCart() {
    const tbody = document.getElementById('ped-itens-tbody');
    if (!this._cart.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:24px"><p>Nenhum item adicionado.</p></div></td></tr>`;
    } else {
      tbody.innerHTML = this._cart.map(i => `<tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td>${fmt.brl(i.unit_price)}</td>
        <td>${fmt.brl(i.unit_price * i.qty)}</td>
        <td><button type="button" class="btn btn-danger btn-sm" onclick="Controllers.pedidos.removeItem(${i.product_id})">✕</button></td>
      </tr>`).join('');
    }
    const total = this._cart.reduce((s, i) => s + i.unit_price * i.qty, 0);
    document.getElementById('ped-total').textContent = fmt.brl(total);
  },

  async save() {
    const clientId = parseInt(document.getElementById('ped-cliente').value);
    if (!clientId) { Toast.show('Selecione um cliente.', 'error'); return; }
    if (!this._cart.length) { Toast.show('Adicione ao menos um item ao pedido.', 'error'); return; }

    const payload = {
      client_id: clientId,
      status: document.getElementById('ped-status').value,
      notes: document.getElementById('ped-obs').value.trim(),
      items: this._cart.map(i => ({ product_id: i.product_id, quantity: i.qty })),
    };

    try {
      if (this._editingId) {
        await API.orders.update(this._editingId, payload);
        Toast.show('Pedido atualizado!');
      } else {
        await API.orders.create(payload);
        Toast.show('Pedido registrado!');
      }
      this.closeModal();
      this.render();
    } catch(e) { Toast.show(e.message, 'error'); }
  },

  async toggleStatus(id, currentStatus) {
    const next = currentStatus === 'Quitado' ? 'Em aberto' : 'Quitado';
    try {
      await API.orders.setStatus(id, next);
      this.render(); Toast.show(`Pedido marcado como ${next}.`);
    } catch(e) { Toast.show(e.message, 'error'); }
  },
  del(id) {
    confirmAction('Excluir este pedido? O estoque será restaurado.', async () => {
      try { await API.orders.delete(id); this.render(); Toast.show('Pedido excluído.'); }
      catch(e) { Toast.show(e.message, 'error'); }
    });
  },

  // Exclui o pedido 
  deleteCurrent() {
    if (!this._editingId) return;
    const id = this._editingId;
    confirmAction('Excluir este pedido? O estoque será restaurado.', async () => {
      try {
        await API.orders.delete(id);
        this.closeModal();
        this.render();
        Toast.show('Pedido excluído.');
      } catch(e) { Toast.show(e.message, 'error'); }
    });
  }
}

// FINANCEIRO 
Controllers.financeiro = {
  async render() {
    let data;
    try { data = await API.dashboard.get(); }
    catch (e) { Toast.show('Erro ao carregar financeiro: ' + e.message, 'error'); return; }

    const { kpis, byCategory } = data;

    document.getElementById('fin-revenue').textContent = fmt.brl(kpis.total_sales);
    document.getElementById('fin-cost').textContent    = fmt.brl(kpis.total_cost);
    document.getElementById('fin-profit').textContent  = fmt.brl(kpis.net_profit);
    document.getElementById('fin-margin').textContent  = kpis.total_sales ? `${Math.round(kpis.net_profit/kpis.total_sales*100)}%` : '0%';

    document.getElementById('fin-cats').innerHTML = byCategory.map(c => {
      const cost = c.revenue - c.profit;
      return `<tr>
        <td>${c.name}</td>
        <td>${fmt.brl(c.revenue)}</td>
        <td>${fmt.brl(cost)}</td>
        <td style="font-weight:600;color:${c.profit>=0?'var(--green-light)':'var(--red)'}">${fmt.brl(c.profit)}</td>
        <td>—</td>
      </tr>`;
    }).join('');
  }
}
