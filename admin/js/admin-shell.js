/**
 * MWS Admin Shell — Shared JavaScript Foundation
 * Phase 1
 *
 * Provides:
 *  • AdminShell      — sidebar toggle, overlay, responsive handling
 *  • AdminSidebar    — accordion nav, active state management
 *  • DataTable       — sort, select-all, row select, pagination
 *  • AdminToast      — show/dismiss toast messages
 *  • AdminModal      — open/close modal dialogs
 *  • TableFilter     — search, filter chips, debounce
 *
 * No external dependencies. Vanilla JS only.
 */

'use strict';

/* ── Utility helpers ────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ── AdminShell ─────────────────────────────────────────────── */
const AdminShell = {
  shell: null,

  init() {
    this.shell = $('.admin-shell');
    if (!this.shell) return;

    // Toggle button in header
    const toggleBtn = $('.admin-header-toggle', this.shell);
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleSidebar());
    }

    // Overlay click (mobile/tablet)
    const overlay = $('.admin-sidebar-overlay', this.shell);
    if (overlay) {
      overlay.addEventListener('click', () => this.closeSidebar());
    }

    // Responsive: auto-collapse on small screens
    this._handleResize();
    window.addEventListener('resize', debounce(() => this._handleResize(), 100));

    // Escape key closes sidebar on tablet
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeSidebar();
    });
  },

  toggleSidebar() {
    if (window.innerWidth < 1024) {
      // On tablet/mobile: toggle sidebar-open
      this.shell.classList.toggle('sidebar-open');
    } else {
      // On desktop: toggle collapsed state
      this.shell.classList.toggle('sidebar-collapsed');
      try {
        localStorage.setItem(
          'admin-sidebar-collapsed',
          this.shell.classList.contains('sidebar-collapsed') ? '1' : '0'
        );
      } catch (e) { /* ignore */ }
    }
  },

  closeSidebar() {
    this.shell.classList.remove('sidebar-open');
  },

  _handleResize() {
    if (window.innerWidth < 1024) {
      // Tablet/mobile: remove desktop states, do not restore
      this.shell.classList.remove('sidebar-collapsed');
    } else {
      // Desktop: restore last saved state
      try {
        const collapsed = localStorage.getItem('admin-sidebar-collapsed') === '1';
        this.shell.classList.toggle('sidebar-collapsed', collapsed);
      } catch (e) { /* ignore */ }
      this.shell.classList.remove('sidebar-open');
    }
  }
};

/* ── AdminSidebar ───────────────────────────────────────────── */
const AdminSidebar = {
  init() {
    // Accordion: click on parent nav-item toggles sub
    $$('.admin-nav-item[data-has-sub]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const sub = item.nextElementSibling;
        if (sub && sub.classList.contains('admin-nav-sub')) {
          const isOpen = sub.classList.toggle('is-open');
          // Rotate chevron icon
          const icon = item.querySelector('.admin-nav-chevron');
          if (icon) {
            icon.style.transform = isOpen ? 'rotate(90deg)' : '';
            icon.style.transition = 'transform 0.2s ease';
          }
        }
      });
    });

    // Set active state based on current page
    this._setActiveFromUrl();
  },

  _setActiveFromUrl() {
    const currentPath = window.location.pathname.split('/').pop();
    $$('.admin-nav-item[data-href], .admin-nav-sub-item[data-href]').forEach(item => {
      const href = item.getAttribute('data-href');
      if (href && currentPath === href) {
        item.classList.add('is-active');
        // Open parent sub if this is a sub-item
        const sub = item.closest('.admin-nav-sub');
        if (sub) {
          sub.classList.add('is-open');
          const parent = sub.previousElementSibling;
          if (parent) parent.classList.add('is-active');
        }
      }
    });
  }
};

/* ── DataTable ──────────────────────────────────────────────── */
const DataTable = {
  /**
   * Initialize a DataTable on a given wrapper element.
   * @param {HTMLElement} wrapper - Element containing .admin-table
   * @param {Object} options
   *   - sortable: boolean (default true)
   *   - selectable: boolean (default true)
   *   - onSelectionChange: function(selectedRows[])
   */
  init(wrapper, options = {}) {
    if (!wrapper) return;

    const opts = {
      sortable: true,
      selectable: true,
      onSelectionChange: null,
      ...options
    };

    const table = $('table.admin-table', wrapper);
    if (!table) return;

    if (opts.sortable) this._initSort(table);
    if (opts.selectable) this._initSelect(table, opts);
  },

  _initSort(table) {
    const headers = $$('th.is-sortable', table);
    headers.forEach(th => {
      th.setAttribute('tabindex', '0');
      th.setAttribute('role', 'columnheader');
      th.setAttribute('aria-sort', 'none');

      const handleSort = () => {
        // Determine next state
        const current = th.getAttribute('aria-sort');
        let next = 'ascending';
        if (current === 'ascending') next = 'descending';
        if (current === 'descending') next = 'none';

        // Reset all
        headers.forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
          h.setAttribute('aria-sort', 'none');
        });

        if (next !== 'none') {
          th.classList.add(next === 'ascending' ? 'sort-asc' : 'sort-desc');
          th.setAttribute('aria-sort', next);
          const colIndex = [...th.parentElement.children].indexOf(th);
          this._sortTableByCol(table, colIndex, next === 'ascending');
        }
      };

      th.addEventListener('click', handleSort);
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSort();
        }
      });
    });
  },

  _sortTableByCol(table, colIndex, asc) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = [...tbody.querySelectorAll('tr')];

    rows.sort((a, b) => {
      const aCell = a.querySelectorAll('td')[colIndex];
      const bCell = b.querySelectorAll('td')[colIndex];
      if (!aCell || !bCell) return 0;

      const aText = (aCell.dataset.sort || aCell.textContent || '').trim();
      const bText = (bCell.dataset.sort || bCell.textContent || '').trim();

      // Try numeric sort
      const aNum = parseFloat(aText.replace(/[^0-9.-]/g, ''));
      const bNum = parseFloat(bText.replace(/[^0-9.-]/g, ''));
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return asc ? aNum - bNum : bNum - aNum;
      }
      return asc
        ? aText.localeCompare(bText, 'ko')
        : bText.localeCompare(aText, 'ko');
    });

    rows.forEach(row => tbody.appendChild(row));
  },

  _initSelect(table, opts) {
    const allCheckbox = $('thead .admin-table-checkbox', table);
    const rowCheckboxes = () => $$('tbody .admin-table-checkbox', table);

    const updateSelectAll = () => {
      const boxes = rowCheckboxes();
      const checkedCount = boxes.filter(c => c.checked).length;
      if (allCheckbox) {
        allCheckbox.checked = checkedCount === boxes.length && boxes.length > 0;
        allCheckbox.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
      }
      // Show/hide bulk toolbar
      const bulkToolbar = table.closest('.admin-list-card, .admin-card')
        ?.previousElementSibling?.classList.contains('admin-bulk-toolbar')
        ? table.closest('.admin-list-card, .admin-card')?.previousElementSibling
        : null;
      if (bulkToolbar) {
        bulkToolbar.classList.toggle('is-visible', checkedCount > 0);
        const countEl = bulkToolbar.querySelector('.admin-bulk-count');
        if (countEl) countEl.textContent = `${checkedCount}개 선택됨`;
      }

      // Row highlight
      rowCheckboxes().forEach(cb => {
        const row = cb.closest('tr');
        if (row) row.classList.toggle('is-selected', cb.checked);
      });

      if (opts.onSelectionChange) {
        const selected = rowCheckboxes()
          .filter(c => c.checked)
          .map(c => c.closest('tr'));
        opts.onSelectionChange(selected);
      }
    };

    if (allCheckbox) {
      allCheckbox.addEventListener('change', () => {
        rowCheckboxes().forEach(cb => { cb.checked = allCheckbox.checked; });
        updateSelectAll();
      });
    }

    // Event delegation on tbody
    const tbody = table.querySelector('tbody');
    if (tbody) {
      tbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('admin-table-checkbox')) {
          updateSelectAll();
        }
      });
    }
  }
};

/* ── Pagination ─────────────────────────────────────────────── */
const Pagination = {
  /**
   * Render pagination into a container.
   * @param {HTMLElement} container - .admin-pagination element
   * @param {Object} opts
   *   - total: total items
   *   - page: current 1-based page
   *   - pageSize: items per page
   *   - onChange: function(newPage)
   */
  render(container, opts) {
    if (!container) return;
    const { total, page, pageSize, onChange } = opts;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    const infoEl = container.querySelector('.admin-pagination-info');
    if (infoEl) {
      infoEl.textContent = `총 ${total.toLocaleString()}건 중 ${start}–${end}건`;
    }

    const nav = container.querySelector('.admin-pagination-nav');
    if (!nav) return;
    nav.innerHTML = '';

    const createBtn = (label, pageNum, isActive = false, disabled = false) => {
      const btn = document.createElement('button');
      btn.className = 'admin-page-btn' + (isActive ? ' is-active' : '');
      btn.innerHTML = label;
      btn.disabled = disabled;
      btn.setAttribute('aria-label', `페이지 ${pageNum}`);
      if (isActive) btn.setAttribute('aria-current', 'page');
      btn.addEventListener('click', () => onChange && onChange(pageNum));
      return btn;
    };

    // Prev
    nav.appendChild(createBtn('<i class="fa-solid fa-chevron-left fa-xs"></i>', page - 1, false, page === 1));

    // Page numbers with ellipsis
    const pages = this._pageRange(page, totalPages);
    pages.forEach(p => {
      if (p === '...') {
        const el = document.createElement('span');
        el.className = 'admin-page-ellipsis';
        el.textContent = '…';
        nav.appendChild(el);
      } else {
        nav.appendChild(createBtn(p, p, p === page));
      }
    });

    // Next
    nav.appendChild(createBtn('<i class="fa-solid fa-chevron-right fa-xs"></i>', page + 1, false, page === totalPages));
  },

  _pageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  }
};

/* ── AdminToast ─────────────────────────────────────────────── */
const AdminToast = {
  container: null,

  _getContainer() {
    if (!this.container) {
      this.container = document.querySelector('.admin-toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.className = 'admin-toast-container';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  },

  show(message, type = 'default', duration = 3000) {
    const container = this._getContainer();
    const toast = document.createElement('div');
    toast.className = `admin-toast${type !== 'default' ? ` toast-${type}` : ''}`;

    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info'
    };

    const icon = icons[type];
    toast.innerHTML = icon
      ? `<i class="fa-solid ${icon}"></i><span>${message}</span>`
      : `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
  }
};

/* ── AdminModal ─────────────────────────────────────────────── */
const AdminModal = {
  open(modalId) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // Focus trap: focus first focusable element
    const focusable = overlay.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) setTimeout(() => focusable.focus(), 50);
  },

  close(modalId) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  },

  initAll() {
    // Auto-close on overlay click
    $$('.admin-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.style.display = 'none';
          document.body.style.overflow = '';
        }
      });
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $$('.admin-modal-overlay').forEach(overlay => {
          if (overlay.style.display !== 'none' && overlay.style.display !== '') {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
          }
        });
      }
    });
  }
};

/* ── TableFilter ─────────────────────────────────────────────── */
const TableFilter = {
  /**
   * Bind a search input to live-filter table rows.
   * @param {HTMLInputElement} input
   * @param {HTMLTableElement} table
   * @param {number[]} colIndexes — which columns to search (default: all text cols)
   */
  bindSearch(input, table, colIndexes = null) {
    if (!input || !table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const filter = debounce((value) => {
      const term = value.toLowerCase().trim();
      $$('tr', tbody).forEach(row => {
        const cells = [...row.querySelectorAll('td')];
        const searchIn = colIndexes
          ? colIndexes.map(i => cells[i]).filter(Boolean)
          : cells;
        const text = searchIn.map(c => c.textContent).join(' ').toLowerCase();
        row.style.display = term === '' || text.includes(term) ? '' : 'none';
      });
    }, 250);

    input.addEventListener('input', (e) => filter(e.target.value));
  }
};

/* ── Admin Tab System ─────────────────────────────────────────── */
const AdminTabs = {
  initAll() {
    $$('[role="tablist"].admin-tabs').forEach(tablist => {
      this._initTablist(tablist);
    });
  },

  _initTablist(tablist) {
    const tabs = $$('.admin-tab-btn', tablist);
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');

        // Show/hide panels
        const targetId = tab.dataset.tab;
        if (targetId) {
          $$('.admin-tab-panel').forEach(p => {
            p.hidden = p.id !== targetId;
          });
        }
      });
    });
  }
};

/* ── Init on DOM ready ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  AdminShell.init();
  AdminSidebar.init();
  AdminModal.initAll();
  AdminTabs.initAll();

  // Init all DataTables on page
  $$('.admin-list-card, .js-datatable-wrap').forEach(wrap => {
    DataTable.init(wrap);
  });
});

/* ── Global exports for screen-level scripts ─────────────────── */
window.MWSAdmin = {
  AdminShell,
  AdminSidebar,
  DataTable,
  Pagination,
  AdminToast,
  AdminModal,
  TableFilter,
  AdminTabs
};
