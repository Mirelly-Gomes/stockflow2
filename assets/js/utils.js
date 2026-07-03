

// Toast notifications
const Toast = {
  show(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
};

// Modal manager
const Modal = {
  open(title, bodyHTML, onSubmit) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    overlay.classList.add('open');
    const form = overlay.querySelector('form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        onSubmit(new FormData(form));
      });
    }
    setTimeout(() => {
      const first = overlay.querySelector('input, select');
      if (first) first.focus();
    }, 50);
  },
  close() {
    document.getElementById('modal-overlay').classList.remove('open');
  }
};

// Simple router - show/hide pages
const Router = {
  current: 'dashboard',
  go(page) {
    Router.current = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active-page');
    document.querySelectorAll('nav a').forEach(a => {
      a.classList.toggle('active', a.dataset.page === page);
    });
    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
    // Render the page
    Controllers[page]?.render();
  }
};

// Format currency BRL
const fmt = {
  brl: (v) => `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
  date: (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR'),
  pct: (v) => `${v}%`
};

// Search filter helper
function filterSearch(arr, q, fields) {
  if (!q) return arr;
  const lq = q.toLowerCase();
  return arr.filter(item => fields.some(f => String(item[f] || '').toLowerCase().includes(lq)));
}

// Confirm dialog
function confirmAction(msg, onConfirm) {
  Modal.open('Confirmar ação',
    `<p style="color:var(--text-secondary);margin-bottom:20px;">${msg}</p>
     <div class="form-actions">
       <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
       <button type="button" class="btn btn-danger" id="confirm-yes">Confirmar</button>
     </div>`, () => {});
  document.getElementById('confirm-yes').onclick = () => { Modal.close(); onConfirm(); };
}
