// Books you write in (a book and quill) and books that have been signed (written books), as in
// Minecraft: the pages drawn like an open book, turned with the arrows, typed straight onto (up to
// fifty pages of 256 characters each), and signed with a title, after which it can only be read.
// A book's writing goes with the item (its `book` extra: see inventory.js).
import { I } from './items.js';

export const BOOK_PAGES = 50, PAGE_CHARS = 256, TITLE_CHARS = 32;
export const cleanPage = (s) => (typeof s === 'string' ? s : '').replace(/\r/g, '').replace(/[^\x20-\x7e\n]/g, '').slice(0, PAGE_CHARS);
export const cleanTitle = (s) => String(s ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, TITLE_CHARS).trim();
const GENERATIONS = ['Original', 'Copy of original', 'Copy of a copy', 'Tattered'];
export const generationLabel = (g) => GENERATIONS[Math.max(0, Math.min(3, g | 0))];

export class BookScreen {
  constructor(game) {
    this.game = game;
    this.slot = -1;
    this.el = document.createElement('section');
    this.el.className = 'screen book-screen';
    this.el.hidden = true;
    const book = document.createElement('div');
    book.className = 'book-page';
    this.count = document.createElement('div');
    this.count.className = 'book-count';
    this.text = document.createElement('textarea');
    Object.assign(this.text, { spellcheck: false, maxLength: PAGE_CHARS, rows: 14 });
    this.text.setAttribute('aria-label', 'Page');
    this.text.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.game.closeBook(); }
      else if (e.key === 'PageDown') { e.preventDefault(); this.turn(1); }
      else if (e.key === 'PageUp') { e.preventDefault(); this.turn(-1); }
    });
    this.text.addEventListener('input', () => {
      const v = cleanPage(this.text.value);
      if (v !== this.text.value) this.text.value = v;
      this.pages[this.page] = v;
    });
    this.reader = document.createElement('div');
    this.reader.className = 'book-text';
    // Signing: the title, who it's by, and a warning.
    this.signBox = document.createElement('div');
    this.signBox.className = 'book-sign';
    const ask = document.createElement('div');
    ask.textContent = 'Enter Book Title:';
    this.title = document.createElement('input');
    Object.assign(this.title, { type: 'text', maxLength: TITLE_CHARS, spellcheck: false, autocomplete: 'off' });
    this.title.setAttribute('aria-label', 'Book title');
    this.title.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.sign(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.signing = false; this.render(); }
    });
    this.title.addEventListener('input', () => this.render(true));
    this.by = document.createElement('div');
    this.by.className = 'book-by';
    const note = document.createElement('div');
    note.className = 'book-note';
    note.textContent = 'Note! When you sign the book, it will no longer be editable.';
    this.signBox.append(ask, this.title, this.by, note);
    const prev = this.arrow('book-prev', '◀', -1), next = this.arrow('book-next', '▶', 1);
    book.append(this.count, this.text, this.reader, this.signBox, prev, next);
    this.buttons = document.createElement('div');
    this.buttons.className = 'book-buttons';
    this.el.append(book, this.buttons);
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.game.closeBook(); });
    (document.getElementById('screen-container')?.parentNode ?? document.body).appendChild(this.el);
  }
  get open() { return this.slot >= 0; }

  arrow(cls, glyph, d) {
    const b = document.createElement('button');
    b.className = `book-arrow ${cls}`;
    b.textContent = glyph;
    b.setAttribute('aria-label', d < 0 ? 'Previous page' : 'Next page');
    b.addEventListener('click', () => { this.game.audio.click?.(); this.turn(d); });
    return b;
  }
  button(label, fn, disabled = false) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = label;
    b.disabled = disabled;
    b.addEventListener('click', () => { this.game.audio.click?.(); fn(); });
    this.buttons.appendChild(b);
    return b;
  }

  // Opens the book in inventory slot `slot` (`stack`).
  show(slot, stack) {
    this.slot = slot;
    this.written = stack.id === I.written_book;
    const b = stack.book ?? {};
    this.pages = Array.isArray(b.p) && b.p.length ? b.p.map(cleanPage) : [''];
    this.bookTitle = b.t ?? '';
    this.author = b.a ?? '';
    this.page = 0;
    this.signing = false;
    this.title.value = '';
    this.el.hidden = false;
    this.render();
    if (!this.written) setTimeout(() => this.text.focus(), 0);
  }
  hide() { this.slot = -1; this.el.hidden = true; this.text.blur(); this.title.blur(); }

  // (A book and quill gets a new blank page when you turn past its last, if there's anything on
  // that one and room for more.)
  turn(d) {
    const last = this.pages.length - 1;
    if (d > 0 && this.page === last) {
      if (this.written || !this.pages[last].trim() || this.pages.length >= BOOK_PAGES) return;
      this.pages.push('');
    }
    this.page = Math.max(0, Math.min(this.pages.length - 1, this.page + d));
    this.render();
    if (!this.written) this.text.focus();
  }

  render(titleOnly = false) {
    const name = this.game.settings.name || 'Player';
    this.by.textContent = `by ${name}`;
    if (titleOnly) { this.signButton.disabled = !cleanTitle(this.title.value); return; }
    const n = this.pages.length;
    this.count.textContent = this.signing ? '' : `Page ${this.page + 1} of ${n}`;
    this.text.hidden = this.written || this.signing;
    this.reader.hidden = !this.written;
    this.signBox.hidden = !this.signing;
    this.el.querySelector('.book-prev').hidden = this.signing || this.page === 0;
    this.el.querySelector('.book-next').hidden = this.signing || (this.written ? this.page >= n - 1 : this.pages.length >= BOOK_PAGES && this.page >= n - 1);
    if (this.written) this.reader.textContent = this.pages[this.page];
    else this.text.value = this.pages[this.page];
    this.buttons.replaceChildren();
    if (this.written) this.button('Done', () => this.game.closeBook());
    else if (this.signing) {
      this.signButton = this.button('Sign and Close', () => this.sign(), !cleanTitle(this.title.value));
      this.button('Cancel', () => { this.signing = false; this.render(); });
      setTimeout(() => this.title.focus(), 0);
    } else {
      this.button('Sign', () => { this.signing = true; this.render(); });
      this.button('Done', () => this.game.closeBook());
    }
  }

  // The pages as they're kept (trailing blank pages dropped).
  kept() {
    const p = this.pages.map(cleanPage);
    while (p.length > 1 && !p[p.length - 1].trim()) p.pop();
    return p;
  }
  sign() {
    const t = cleanTitle(this.title.value);
    if (!t) return;
    this.game.signBook(this.slot, { p: this.kept(), t, a: this.game.settings.name || 'Player', g: 0 });
  }
}
