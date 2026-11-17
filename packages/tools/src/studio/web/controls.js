// ─── Shared dropdown vertical placement ───────────────────────────────────
// Standard anchored dropdowns open below their trigger. They only flip above
// when the full dropdown does not fit below and the upper side has more room.
// If neither side fits, callers constrain the dropdown to `availableHeight`.

function _dropdownVerticalPlacement(
  anchorRect,
  contentHeight,
  viewportHeight,
  options = {},
) {
  const edge = Number.isFinite(options.edge) ? Math.max(0, options.edge) : 8;
  const gap = Number.isFinite(options.gap) ? Math.max(0, options.gap) : 4;
  const aboveReferenceTop = Number.isFinite(options.aboveReferenceTop)
    ? options.aboveReferenceTop
    : anchorRect.top;
  const spaceAbove = Math.max(0, aboveReferenceTop - gap - edge);
  const spaceBelow = Math.max(0, viewportHeight - anchorRect.bottom - gap - edge);
  const fullHeight = Math.max(0, Number(contentHeight) || 0);
  const openAbove = fullHeight > spaceBelow && spaceAbove > spaceBelow;
  const availableHeight = openAbove ? spaceAbove : spaceBelow;
  const visibleHeight = Math.min(fullHeight, availableHeight);
  const top = openAbove
    ? Math.max(edge, aboveReferenceTop - gap - visibleHeight)
    : anchorRect.bottom + gap;

  return {
    openAbove,
    availableHeight,
    visibleHeight,
    spaceAbove,
    spaceBelow,
    top,
  };
}

if (typeof module !== 'undefined' && typeof module.exports === 'object') {
  module.exports = { _dropdownVerticalPlacement };
}

// ─── Custom dropdown (AiSelect) ───────────────────────────────────────────
// Native <select> renders OS-default chrome that looks dated next to the
// rest of the app. AiSelect is a minimal styled replacement:
//   - mount point: <div class="ai-select" id="...">
//   - set options via _aiSelectMount(el, { options, value, placeholder,
//                                          onChange })
//   - reads current value via el.dataset.value (string)
// Keyboard: Enter/Space toggles the popover, arrow keys to nav, Esc to close.

const AI_SELECT_BASE_POPOVER_Z_INDEX = 14000;
let _aiSelectIdSeq = 0;

function _aiSelectNormalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  const seen = new Set();
  const normalized = [];
  for (const raw of options) {
    if (!raw || typeof raw !== 'object' || typeof raw.value !== 'string' || seen.has(raw.value)) continue;
    seen.add(raw.value);
    normalized.push({
      ...raw,
      label: raw.label === null || raw.label === undefined ? raw.value : String(raw.label),
      hint: raw.hint === null || raw.hint === undefined ? '' : String(raw.hint),
      iconName: raw.iconName === null || raw.iconName === undefined ? '' : String(raw.iconName),
      ...(raw.disabled === true ? { disabled: true } : {}),
    });
  }
  return normalized;
}

function _aiSelectNextZIndex(values, fallback = AI_SELECT_BASE_POPOVER_Z_INDEX) {
  let z = fallback;
  for (const raw of values || []) {
    const n = Number.parseInt(String(raw || ''), 10);
    if (Number.isFinite(n)) z = Math.max(z, n + 1);
  }
  return z;
}

function _aiSelectPopoverZIndexFor(el) {
  const values = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const raw = window.getComputedStyle(n).zIndex;
    if (raw && raw !== 'auto') values.push(raw);
  }
  // Some modal systems put the high z-index on a sibling/backdrop instead
  // of an ancestor of the select. Include visible app overlays so a body-
  // portaled dropdown still paints above the current dialog layer.
  if (typeof document !== 'undefined' && document.body) {
    const layerSelector = [
      '.modal-overlay.open',
      '.ui-dialog-overlay.open',
      '[role="dialog"][aria-modal="true"]',
    ].join(',');
    for (const n of document.querySelectorAll(layerSelector)) {
      if (!n || n === el || n.hidden) continue;
      const style = window.getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (style.zIndex && style.zIndex !== 'auto') values.push(style.zIndex);
    }
  }
  return _aiSelectNextZIndex(values);
}

function _aiSelectMount(el, config) {
  if (!el) return null;
  const state = {
    options: [],        // [{value, label, hint?, iconName?, avatar?, disabled?}]
    value: '',
    allowMultiple: false,
    multiple: false,
    values: [],
    placeholder: (t('ai_select.placeholder')),
    onChange: () => {},
    open: false,
    activeIdx: -1,
  };
  Object.assign(state, config || {});
  state.options = _aiSelectNormalizeOptions(state.options);
  state.value = typeof state.value === 'string' ? state.value : '';
  state.placeholder = String(state.placeholder || t('ai_select.placeholder'));
  if (state.value && !state.options.some(
    option => option.value === state.value && !option.disabled && typeof option.action !== 'function',
  )) state.value = '';

  state.multiple = state.allowMultiple && state.multiple === true;
  const disabled = option => option.disabled || (state.multiple && option.singleOnly);
  const normalizeValues = values => state.options
    .filter(option => !disabled(option) && typeof option.action !== 'function' && values.includes(option.value)).map(option => option.value);
  state.values = state.multiple ? normalizeValues(state.values) : (state.value ? [state.value] : []);

  const caretIcon = (typeof window !== 'undefined' && typeof window.uiIconHtml === 'function')
    ? window.uiIconHtml('chevron-down', 'ai-select-caret')
    : '';

  el.classList.add('ai-select');
  const controlId = el.id || `ai-select-${++_aiSelectIdSeq}`;
  const triggerId = `${controlId}-trigger`;
  const listboxId = `${controlId}-listbox`;
  const accessibleName = () => String(
    state.ariaLabel
    || el.getAttribute?.('aria-label')
    || state.placeholder,
  );
  el.innerHTML = `
    <button type="button" class="ai-select-trigger" id="${escapeHtml(triggerId)}" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="${escapeHtml(listboxId)}" aria-label="${escapeHtml(accessibleName())}">
      <span class="ai-select-label"></span>
      ${caretIcon}
    </button>
    <div class="ai-select-popover" id="${escapeHtml(listboxId)}" role="listbox" aria-labelledby="${escapeHtml(triggerId)}" hidden></div>
  `;

  const trigger = el.querySelector('.ai-select-trigger');
  const labelEl = el.querySelector('.ai-select-label');
  const popover = el.querySelector('.ai-select-popover');

  const renderOptionLabel = (target, opt) => {
    target.innerHTML = '';
    if (opt && opt.avatar && typeof renderAvatarHtml === 'function') {
      const avatar = document.createElement('span');
      avatar.className = 'ai-select-option-icon';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.innerHTML = renderAvatarHtml(opt.avatar.icon, opt.avatar.color, {
        size: 18, seed: opt.avatar.seed,
      });
      target.appendChild(avatar);
    } else if (opt && opt.iconName && typeof window !== 'undefined' && typeof window.uiIconHtml === 'function') {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'ai-select-option-icon';
      iconWrap.innerHTML = window.uiIconHtml(opt.iconName, 'ui-icon ai-select-svg-icon');
      target.appendChild(iconWrap);
    }
    const text = document.createElement('span');
    text.textContent = opt ? opt.label : state.placeholder;
    target.appendChild(text);
  };

  const renderTrigger = () => {
    trigger.setAttribute('aria-label', accessibleName());
    const selected = state.multiple ? state.options.filter(o => state.values.includes(o.value)) : [];
    const opt = state.multiple
      ? (selected.length ? { label: selected.map(o => o.label).join(t('ai_select.separator')) } : null)
      : state.options.find(o => o.value === state.value);
    if (opt) {
      renderOptionLabel(labelEl, opt);
      labelEl.classList.remove('placeholder');
    } else {
      renderOptionLabel(labelEl, null);
      labelEl.classList.add('placeholder');
    }
    el.dataset.value = state.value || '';
    if (state.allowMultiple) {
      el.dataset.values = JSON.stringify(state.values);
      trigger.title = opt ? opt.label : '';
      trigger.setAttribute('aria-label', opt ? accessibleName() + ': ' + opt.label : accessibleName());
    }
  };

  const renderPopover = () => {
    const scrollTop = popover.scrollTop;
    popover.innerHTML = '';
    popover.setAttribute('aria-multiselectable', String(state.multiple));
    if (state.allowMultiple) {
      const header = document.createElement('label');
      header.className = 'ai-select-multiple-row';
      header.textContent = t('ai_select.multiple');
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.className = 'ai-select-multiple-toggle';
      toggle.setAttribute('role', 'switch');
      toggle.checked = state.multiple;
      toggle.addEventListener('change', () => {
        api.setMultiple(toggle.checked);
        state.onChange(state.multiple ? [...state.values] : state.value);
        popover.querySelector('.ai-select-multiple-toggle')?.focus();
      });
      header.appendChild(toggle);
      popover.appendChild(header);
    }
    if (state.options.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'ai-select-empty';
      empty.textContent = t('ai_select.empty');
      popover.appendChild(empty);
      return;
    }
    state.options.forEach((opt, idx) => {
      const item = document.createElement('div');
      item.className = 'ai-select-item' + (typeof opt.action === 'function' ? ' is-action' : '');
      item.id = `${listboxId}-option-${idx}`;
      item.dataset.value = opt.value;
      item.setAttribute('role', 'option');
      const selected = state.multiple ? state.values.includes(opt.value) : opt.value === state.value;
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.setAttribute('aria-disabled', disabled(opt) ? 'true' : 'false');
      if (selected) item.classList.add('active');
      if (disabled(opt)) item.classList.add('disabled');
      if (idx === state.activeIdx) item.classList.add('hover');
      const main = document.createElement('div');
      main.className = 'ai-select-item-label';
      renderOptionLabel(main, opt);
      item.appendChild(main);
      if (state.multiple && selected) {
        const check = document.createElement('span');
        check.className = 'ai-select-check';
        check.setAttribute('aria-hidden', 'true');
        check.innerHTML = typeof window.uiIconHtml === 'function' ? window.uiIconHtml('check', 'ui-icon') : '\u2713';
        main.appendChild(check);
      }
      if (opt.hint) {
        const hint = document.createElement('div');
        hint.className = 'ai-select-item-hint';
        hint.textContent = opt.hint;
        item.appendChild(hint);
      }
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (disabled(opt)) return;
        _aiSelectPick(api, opt.value);
      });
      item.addEventListener('mouseenter', () => {
        if (disabled(opt)) return;
        state.activeIdx = idx;
        popover.querySelectorAll('.ai-select-item').forEach((n, i) => n.classList.toggle('hover', i === idx));
      });
      popover.appendChild(item);
    });
    if (state.allowMultiple) popover.scrollTop = scrollTop;
    const active = state.activeIdx >= 0
      ? popover.querySelectorAll('.ai-select-item')[state.activeIdx]
      : null;
    if (active) trigger.setAttribute('aria-activedescendant', active.id);
    else trigger.removeAttribute('aria-activedescendant');
  };

  // Portal the popover to <body> while open so an ancestor with
  // `overflow: auto / hidden` (modals, settings panes) can't clip it.
  // We set `position: fixed` + viewport coords from the trigger's
  // bounding rect; on scroll/resize we re-measure. This replaces the
  // earlier "popover lives inside .ai-select" layout — the markup
  // still renders the popover inside .ai-select for first paint, but
  // open/close moves it back and forth.
  let portalParent = null;
  let portalNextSibling = null;
  const reposition = () => {
    if (!state.open) return;
    // Establish the portal's final positioning before measuring. An absolute
    // popover under body can temporarily add a scrollbar and shift a centered
    // trigger; the scrollbar vanishes once the menu is positioned in view.
    popover.style.position = 'fixed';
    // The in-slot CSS sets both edges. With an explicit portal width, RTL
    // resolves that overconstraint by ignoring left; release the opposite edge.
    popover.style.right = 'auto';
    popover.style.top = '0px';
    const rect = trigger.getBoundingClientRect();
    popover.dataset.uiOverlay = '';
    popover.style.left = rect.left + 'px';
    popover.style.width = rect.width + 'px';
    popover.style.maxHeight = '';
    const popH = popover.offsetHeight || 260;
    const placement = _dropdownVerticalPlacement(rect, popH, window.innerHeight, {
      edge: 8,
      gap: 4,
    });
    popover.style.top = placement.top + 'px';
    popover.style.maxHeight = Math.min(260, placement.availableHeight) + 'px';
    popover.dataset.placement = placement.openAbove ? 'top' : 'bottom';
    popover.style.zIndex = String(_aiSelectPopoverZIndexFor(el));
  };
  const open = () => {
    if (state.open) return;
    state.open = true;
    el.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    popover.hidden = false;
    portalParent = popover.parentNode;
    portalNextSibling = popover.nextSibling;
    document.body.appendChild(popover);
    const selectedIdx = state.options.findIndex(o => (state.multiple ? state.values.includes(o.value) : o.value === state.value) && !disabled(o));
    state.activeIdx = selectedIdx >= 0
      ? selectedIdx
      : state.options.findIndex(option => !disabled(option));
    renderPopover();
    reposition();
    setTimeout(() => document.addEventListener('mousedown', onDocDown, true), 0);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition, true);
  };

  const close = () => {
    if (!state.open) return;
    state.open = false;
    el.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    popover.hidden = true;
    popover.style.position = '';
    popover.style.left = '';
    popover.style.right = '';
    popover.style.top = '';
    popover.style.width = '';
    popover.style.maxHeight = '';
    popover.style.zIndex = '';
    delete popover.dataset.placement;
    // Restore popover to its original parent if that parent is still
    // attached to the document. If the host widget got removed mid-open
    // (e.g., the detail page re-rendered and replaced our slot), just
    // detach the popover so it doesn't dangle on document.body.
    if (portalParent) {
      if (portalParent.isConnected) {
        portalParent.insertBefore(popover, portalNextSibling);
      } else if (popover.parentNode) {
        popover.parentNode.removeChild(popover);
      }
      portalParent = null;
      portalNextSibling = null;
    }
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition, true);
  };

  const onDocDown = (e) => {
    if (!el.contains(e.target) && !popover.contains(e.target)) close();
  };
  const nextEnabledIndex = (start, step) => {
    for (let idx = start; idx >= 0 && idx < state.options.length; idx += step) {
      if (!disabled(state.options[idx])) return idx;
    }
    return state.activeIdx;
  };
  const onKey = (e) => {
    // IME composition guard (CLAUDE.md §8): the popover keydown listener
    // is on `document`, so a Chinese / Japanese / Korean composition in an
    // adjacent input would otherwise commit its Enter into "pick the
    // active option" of this select.
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') { close(); if (state.allowMultiple) trigger.focus(); e.preventDefault(); }
    else if (state.allowMultiple && e.key === 'Tab') { close(); if (e.target !== trigger) trigger.focus(); }
    else if (e.target.classList?.contains('ai-select-multiple-toggle')) return;
    else if (e.key === 'ArrowDown') {
      state.activeIdx = nextEnabledIndex(state.activeIdx + 1, 1);
      renderPopover();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      state.activeIdx = nextEnabledIndex(
        state.activeIdx < 0 ? state.options.length - 1 : state.activeIdx - 1,
        -1,
      );
      renderPopover();
      e.preventDefault();
    } else if (e.key === 'Enter' || (state.multiple && e.key === ' ')) {
      if (
        state.activeIdx >= 0
        && state.activeIdx < state.options.length
        && !disabled(state.options[state.activeIdx])
      ) {
        _aiSelectPick(api, state.options[state.activeIdx].value);
        e.preventDefault();
      }
    }
  };

  trigger.addEventListener('click', () => state.open ? close() : open());

  const api = {
    el,
    state,
    setOptions(options, { value, placeholder } = {}) {
      state.options = _aiSelectNormalizeOptions(options);
      if (typeof value === 'string') state.value = value;
      if (typeof placeholder === 'string') state.placeholder = placeholder;
      // Normalize value if not in options
      if (state.value && !state.options.some(
        option => option.value === state.value && !option.disabled && typeof option.action !== 'function',
      )) state.value = '';
      if (
        state.activeIdx >= state.options.length
        || state.options[state.activeIdx]?.disabled
      ) {
        state.activeIdx = state.options.findIndex(option => !disabled(option));
      }
      if (state.multiple) state.values = normalizeValues(state.values);
      else state.values = state.value ? [state.value] : [];
      renderTrigger();
      if (state.open) renderPopover();
    },
    setValue(value) {
      state.value = typeof value === 'string' && state.options.some(
        option => option.value === value && !option.disabled && typeof option.action !== 'function',
      )
        ? value
        : '';
      renderTrigger();
    },
    setSelection(values, multiple) {
      state.multiple = state.allowMultiple && multiple === true;
      state.values = normalizeValues(Array.isArray(values) ? values : []);
      state.value = state.multiple ? '' : (state.values.length === 1 ? state.values[0] : '');
      if (!state.multiple) state.values = state.value ? [state.value] : [];
      renderTrigger();
      if (state.open) { renderPopover(); reposition(); }
    },
    setMultiple(multiple) {
      const values = state.multiple ? state.values : (state.value ? [state.value] : []);
      const expanded = values.flatMap(value => {
        const option = state.options.find(opt => opt.value === value);
        return multiple && option?.singleOnly ? (option.multipleValues || []) : [value];
      });
      api.setSelection(expanded, multiple);
    },
    isMultiple() { return state.multiple; },
    getValues() { return state.multiple ? [...state.values] : (state.value ? [state.value] : []); },
    toggleValue(value) {
      const next = state.options.find(option => option.value === value);
      if (!next || disabled(next)) return;
      const values = state.values.includes(value) ? state.values.filter(v => v !== value) : [...state.values, value];
      api.setSelection(values, true);
      state.onChange([...state.values]);
    },
    setAriaLabel(value) {
      state.ariaLabel = value === null || value === undefined ? '' : String(value);
      renderTrigger();
    },
    getValue() { return state.value; },
    onChange(fn) { state.onChange = typeof fn === 'function' ? fn : () => {}; },
    close,
  };

  renderTrigger();
  return api;
}

function _aiSelectPick(api, value) {
  const next = api.state.options.find(option => option.value === value);
  if (!next || next.disabled || (api.state.multiple && next.singleOnly)) return;
  if (typeof next.action === 'function') { api.close(); next.action(); return; }
  if (api.state.multiple) { api.toggleValue(value); return; }
  const prev = api.state.value;
  api.state.value = value || '';
  api.el.dataset.value = api.state.value;
  api.close();
  if (prev !== api.state.value) {
    try { api.state.onChange(api.state.value); } catch (_) {}
  }
  api.setValue(api.state.value);
}


// ─── Generic right-click context menu ───
// Small floating menu anchored at the cursor; items are { label, onClick,
// disabled?, danger?, icon? }. There's exactly one menu instance at a time — opening a new
// menu closes the previous one. A row may provide a leading `icon`, a
// structured Agent `avatar`, and/or a `trailingIcon` for selection state.
// Dismissers: outside click, Escape, scroll,
// resize, and the i18n-change broadcast (label text may need refreshing).
//
// IME guard (CLAUDE.md §8): the up/down/Enter shortcuts early-return when a
// composition is active so a half-typed Chinese candidate doesn't trigger
// the wrong menu item.



let _ctxMenuEl = null;
let _ctxMenuItems = [];
let _ctxMenuActiveIdx = -1;
let _ctxMenuOpen = false;
let _ctxMenuPreviousFocus = null;

function _runContextMenuAction(item) {
  if (!item || item.disabled) return;
  try {
    const result = item.onClick();
    if (result && typeof result.then === 'function') {
      Promise.resolve(result).catch(() => uiToast(t('video_canvas.error.failed'), { variant: 'warning' }));
    }
  } catch (_) {
    uiToast(t('video_canvas.error.failed'), { variant: 'warning' });
  }
}

function showContextMenu(event, items) {
  closeContextMenu();
  if (!Array.isArray(items) || items.length === 0) return;
  _ctxMenuItems = items.filter((it) => it && typeof it.label === 'string' && typeof it.onClick === 'function');
  if (_ctxMenuItems.length === 0) return;

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.setAttribute('role', 'menu');
  menu.tabIndex = -1;
  _ctxMenuItems.forEach((it, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `context-menu-item${it.danger ? ' is-danger' : ''}${it.disabled ? ' is-disabled' : ''}`;
    btn.dataset.contextMenuIdx = String(idx);
    btn.setAttribute('role', 'menuitem');
    btn.setAttribute('tabindex', '-1');
    btn.disabled = !!it.disabled;
    if (it.avatar && typeof renderAvatarHtml === 'function') {
      const avatar = document.createElement('span');
      avatar.className = 'context-menu-avatar';
      avatar.innerHTML = renderAvatarHtml(it.avatar.icon, it.avatar.color, {
        size: 18,
        seed: it.avatar.seed,
        extraClass: 'context-menu-agent-avatar',
      });
      btn.appendChild(avatar);
    } else if (it.icon && typeof uiIconHtml === 'function') {
      const icon = document.createElement('span');
      icon.className = 'context-menu-icon';
      icon.innerHTML = uiIconHtml(it.icon);
      btn.appendChild(icon);
    }
    const label = document.createElement('span');
    label.className = 'context-menu-label';
    label.textContent = it.label;
    btn.appendChild(label);
    if (it.trailingIcon && typeof uiIconHtml === 'function') {
      const trailingIcon = document.createElement('span');
      trailingIcon.className = 'context-menu-trailing-icon';
      trailingIcon.innerHTML = uiIconHtml(it.trailingIcon);
      btn.appendChild(trailingIcon);
    }
    menu.appendChild(btn);
  });
  _ctxMenuPreviousFocus = document.activeElement;
  document.body.appendChild(menu);
  _ctxMenuEl = menu;
  _ctxMenuOpen = true;
  _ctxMenuActiveIdx = -1;

  // Place at cursor; flip when overflowing viewport. Read offset after
  // appending so the menu has real dimensions.
  const x = Number.isFinite(event && event.clientX) ? event.clientX : 0;
  const y = Number.isFinite(event && event.clientY) ? event.clientY : 0;
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 4;
  const preferredLeft = x + rect.width > vw - margin ? x - rect.width : x;
  const preferredTop = y + rect.height > vh - margin ? y - rect.height : y;
  const left = Math.min(
    Math.max(margin, vw - rect.width - margin),
    Math.max(margin, preferredLeft),
  );
  const top = Math.min(
    Math.max(margin, vh - rect.height - margin),
    Math.max(margin, preferredTop),
  );
  menu.style.left = `${left}px`;
  menu.style.top  = `${top}px`;

  menu.querySelectorAll('.context-menu-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(btn.dataset.contextMenuIdx);
      const it = _ctxMenuItems[idx];
      closeContextMenu();
      _runContextMenuAction(it);
    });
    btn.addEventListener('mouseenter', () => {
      const idx = Number(btn.dataset.contextMenuIdx);
      _setActiveIdx(idx);
    });
  });

  const firstEnabled = _ctxMenuItems.findIndex((item) => !item.disabled);
  if (firstEnabled >= 0) _setActiveIdx(firstEnabled);
  else menu.focus();
}

function closeContextMenu() {
  if (!_ctxMenuOpen) return;
  _ctxMenuOpen = false;
  _ctxMenuActiveIdx = -1;
  if (_ctxMenuEl && _ctxMenuEl.parentNode) _ctxMenuEl.parentNode.removeChild(_ctxMenuEl);
  _ctxMenuEl = null;
  _ctxMenuItems = [];
  const previousFocus = _ctxMenuPreviousFocus;
  _ctxMenuPreviousFocus = null;
  try { previousFocus?.focus?.(); } catch (_) {}
}

function _setActiveIdx(idx) {
  if (!_ctxMenuEl) return;
  if (idx < 0 || idx >= _ctxMenuItems.length) {
    _ctxMenuActiveIdx = -1;
  } else {
    _ctxMenuActiveIdx = idx;
  }
  _ctxMenuEl.querySelectorAll('.context-menu-item').forEach((btn, i) => {
    const active = i === _ctxMenuActiveIdx;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('tabindex', active ? '0' : '-1');
    if (active) {
      try { btn.focus(); } catch (_) {}
    }
  });
}

function _findEnabledIdx(from, direction) {
  const length = _ctxMenuItems.length;
  if (!length) return -1;
  const start = from >= 0 ? from : (direction > 0 ? -1 : 0);
  for (let step = 1; step <= length; step += 1) {
    const idx = (start + direction * step + length * 2) % length;
    if (!_ctxMenuItems[idx].disabled) return idx;
  }
  return -1;
}

// ── Dismissers ─────────────────────────────────────────────────────────

document.addEventListener('mousedown', (e) => {
  if (!_ctxMenuOpen) return;
  if (_ctxMenuEl && _ctxMenuEl.contains(e.target)) return;
  closeContextMenu();
}, true);

document.addEventListener('keydown', (e) => {
  if (!_ctxMenuOpen) return;
  // IME composition guard — Chinese / Japanese / Korean Enter commits a
  // candidate; don't fire menu actions while a composition is active.
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Escape') { e.preventDefault(); closeContextMenu(); return; }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = _findEnabledIdx(_ctxMenuActiveIdx, 1);
    if (next >= 0) _setActiveIdx(next);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = _findEnabledIdx(_ctxMenuActiveIdx, -1);
    if (prev >= 0) _setActiveIdx(prev);
    return;
  }
  if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    const next = _findEnabledIdx(-1, e.key === 'Home' ? 1 : -1);
    if (next >= 0) _setActiveIdx(next);
    return;
  }
  if (e.key === 'Tab') {
    closeContextMenu();
    return;
  }
  if (e.key === 'Enter') {
    if (_ctxMenuActiveIdx < 0) return;
    const it = _ctxMenuItems[_ctxMenuActiveIdx];
    if (!it || it.disabled) return;
    e.preventDefault();
    closeContextMenu();
    _runContextMenuAction(it);
  }
});

window.addEventListener('scroll', () => closeContextMenu(), true);
window.addEventListener('resize', () => closeContextMenu());
window.addEventListener('i18n-change', () => closeContextMenu());

window.showContextMenu = showContextMenu;
window.closeContextMenu = closeContextMenu;
