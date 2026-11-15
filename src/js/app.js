/*
 * SwapCycle user interface. Hash-based pages, rendered from the data in services.js.
 * Pages: sign in, register, browse, my books, wishlist, swaps, profile.
 */
(function () {
  'use strict';

  const { createStore, GENRES, CONDITIONS, PROBLEM_REASONS } = window.SwapCycle;

  // localStorage = shared data, sessionStorage = who is signed in on this tab
  function safeStorage(name) {
    try {
      const st = window[name];
      st.setItem('__test', '1');
      st.removeItem('__test');
      return st;
    } catch (e) {
      return null; // blocked: falls back to memory, lasts until the tab closes
    }
  }
  const store = createStore(safeStorage('localStorage'), null, safeStorage('sessionStorage'));

  const $app = document.getElementById('app');
  const $nav = document.getElementById('nav');
  const $toast = document.getElementById('toast');

  // What the user has typed into filters, so re-rendering doesn't wipe it
  const view = {
    browse: { query: '', genre: '', condition: '', availableOnly: false, sort: 'newest' },
    wish: { query: '', genre: '', sort: 'priority', hideAcquired: false, availableOnly: false },
    requesting: null,  // listing id with the swap form open
    reporting: null,   // exchange id with the problem form open
    rescheduling: null, // exchange id with the reschedule form open
    changingPassword: false,
    chatWith: null,  // user id of the open conversation
    chatAbout: null, // listing the conversation started from
    draft: ''        // unsent message text, kept when the page redraws
  };

  /* ---------- Helpers ---------- */

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const options = (list, selected, placeholder) =>
    (placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : '') +
    list.map((v) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');

  const stars = (n) => (n == null ? '<span class="muted">No ratings yet</span>'
    : `<span class="stars">${'★'.repeat(Math.round(n))}${'☆'.repeat(5 - Math.round(n))}</span> ${n}`);

  const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtMeeting = (m) => `${new Date(m.date + 'T' + m.time).toLocaleString(undefined,
    { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${esc(m.place)}`;

  const STATUS_TEXT = {
    pending: 'Waiting for reply', accepted: 'Accepted', declined: 'Declined',
    cancelled: 'Cancelled', completed: 'Completed', problem: 'Problem reported'
  };

  let toastTimer;
  function toast(msg, type) {
    $toast.textContent = msg;
    $toast.className = 'toast show' + (type === 'error' ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.className = 'toast'; }, 3000);
  }

  // Runs an action, shows any error as a toast, then redraws the page
  function run(fn, okMsg) {
    try {
      fn();
      if (okMsg) toast(okMsg);
      render();
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  }

  // In-page yes/no dialog (browser confirm() is blocked in some hosts)
  function ask(message, onYes) {
    const box = document.createElement('div');
    box.className = 'dialog-backdrop';
    box.innerHTML = `
      <div class="dialog card" role="alertdialog" aria-modal="true" aria-labelledby="dlg-msg">
        <p id="dlg-msg">${esc(message)}</p>
        <div class="actions">
          <button class="danger" data-yes>Yes</button>
          <button class="secondary" data-no>No</button>
        </div>
      </div>`;
    const close = () => box.remove();
    box.addEventListener('click', (e) => {
      if (e.target.closest('[data-yes]')) { close(); onYes(); }
      else if (e.target.closest('[data-no]') || e.target === box) close();
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.body.appendChild(box);
    box.querySelector('[data-no]').focus();
  }

  const go = (page) => { location.hash = '#' + page; };

  /* ---------- Navigation ---------- */

  function renderNav(user, page) {
    if (!user) {
      $nav.innerHTML = `
        <a href="#signin" class="${page === 'signin' ? 'active' : ''}">Sign in</a>
        <a href="#register" class="${page === 'register' ? 'active' : ''}">Create account</a>`;
      return;
    }
    const waiting = store.getMyExchanges().filter((x) => x.role === 'owner' && x.status === 'pending').length;
    const unread = store.unreadMessageCount();
    const link = (p, label, extra = '') =>
      `<a href="#${p}" class="${page === p ? 'active' : ''}" ${page === p ? 'aria-current="page"' : ''}>${label}${extra}</a>`;
    $nav.innerHTML =
      `<div class="nav-links">` +
      link('browse', 'Browse') +
      link('mybooks', 'My books') +
      link('wishlist', 'Wishlist') +
      link('swaps', 'Exchanges', waiting ? `<span class="badge-count">${waiting}</span>` : '') +
      link('messages', 'Messages', unread ? `<span class="badge-count">${unread}</span>` : '') +
      `</div>` +
      `<a href="#mybooks" class="btn btn-navy">+ List a Book</a>` +
      `<a href="#profile" class="nav-avatar" title="Profile" aria-label="Your profile">${avatar(user, 'sm')}</a>`;
  }

  function avatar(user, size) {
    const initials = esc((user.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase());
    return `<span class="avatar ${size}">${user.photo
      ? `<img src="${user.photo}" alt="">` : `<span>${initials}</span>`}</span>`;
  }

  // Shrinks the chosen photo to 200px so it fits in localStorage
  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(png|jpeg)$/.test(file.type)) return reject(new Error('Photo must be a JPG or PNG.'));
      if (file.size > 5 * 1024 * 1024) return reject(new Error('Photo must be 5 MB or smaller.'));
      const img = new Image();
      img.onload = () => {
        const side = 200;
        const c = document.createElement('canvas');
        c.width = c.height = side;
        const s = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, side, side);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------- Pages ---------- */

  // Left panel shared by the sign-in and create-account pages
  function authHero() {
    return `
      <section class="auth-hero" aria-hidden="true">
        <div class="hero-inner">
          <svg class="hero-art" viewBox="0 0 320 200" role="img">
            <rect x="0" y="0" width="320" height="200" rx="12" fill="#ffffff" stroke="#a9bff0"/>
            <rect x="60" y="150" width="200" height="12" rx="3" fill="#a9bff0"/>
            <rect x="78" y="62" width="30" height="88" rx="3" fill="#1e3a8a"/>
            <rect x="112" y="48" width="26" height="102" rx="3" fill="#5f75c0"/>
            <rect x="142" y="70" width="34" height="80" rx="3" fill="#c4b5fd"/>
            <rect x="180" y="56" width="24" height="94" rx="3" fill="#a5c0fb"/>
            <rect x="208" y="84" width="34" height="66" rx="3" fill="#1e3a8a" transform="rotate(12 225 117)"/>
            <path d="M118 30 q42 -24 84 0" fill="none" stroke="#5f75c0" stroke-width="3" stroke-linecap="round"/>
            <path d="M196 22 l8 8 l-11 3" fill="none" stroke="#5f75c0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2 class="hero-title">Swap books, not money.</h2>
          <p class="hero-text">Trade the books you've finished for the ones you want with readers near you.</p>
        </div>
      </section>`;
  }

  function signinPage() {
    return `
      <div class="auth-split">
        ${authHero()}
        <section class="auth-panel">
          <div class="auth-box">
            <h1>Sign in</h1>
            <p class="sub">Welcome back. Enter your details to continue.</p>
            <form data-form="signIn" class="stack" novalidate>
              <div><label for="si-email">Email</label><input id="si-email" name="email" type="email" autocomplete="email" placeholder="name@email.com" required></div>
              <div><label for="si-pass">Password</label><input id="si-pass" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required></div>
              <div class="spread">
                <label class="check"><input type="checkbox" name="remember" checked> Remember me</label>
                <a href="#" class="forgot" data-action="forgot">Forgot password?</a>
              </div>
              ${view.forgotOpen ? `<p class="note">Password reset by email comes with the server in a later sprint.
                For now, use a demo account or create a new one.</p>` : ''}
              <button type="submit" class="btn-auth">Sign in</button>
            </form>
            <div class="divider"><span>or</span></div>
            <a href="#register" class="btn btn-outline">Create an account</a>
            <p class="demo-line">Presenting? <button class="link-btn" data-action="seed">Load demo accounts</button>
              <span class="hint">(password: password123)</span></p>
          </div>
        </section>
      </div>`;
  }

  function registerPage() {
    return `
      <div class="auth-split">
        ${authHero()}
        <section class="auth-panel">
          <div class="auth-box">
            <h1>Create an account</h1>
            <p class="sub">Join SwapCycle and start swapping books near you.</p>
            <form data-form="register" class="stack" novalidate>
              <div><label for="rg-name">Full name</label><input id="rg-name" name="name" autocomplete="name" placeholder="Your name" required></div>
              <div><label for="rg-email">Email</label><input id="rg-email" name="email" type="email" autocomplete="email" placeholder="name@email.com" required></div>
              <div><label for="rg-pass">Password</label><input id="rg-pass" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required></div>
              <button type="submit" class="btn-auth">Create account</button>
            </form>
            <div class="divider"><span>or</span></div>
            <a href="#signin" class="btn btn-outline">Sign in instead</a>
          </div>
        </section>
      </div>`;
  }

  function browsePage() {
    const f = view.browse;
    const list = store.browseListings(f);
    let mine = [];
    try { mine = store.myListings().filter((l) => l.status === 'available'); } catch (e) { /* signed out */ }

    const cards = list.map((l) => {
      const open = view.requesting === l.id;
      const today = new Date().toISOString().slice(0, 10);
      return `
        <article class="card">
          <div class="book-title">${esc(l.title)}</div>
          <div class="muted">by ${esc(l.author)}</div>
          <div class="tags">
            <span class="tag">${esc(l.genre)}</span>
            <span class="tag">${esc(l.condition)}</span>
            <span class="tag ${l.status}">${l.status === 'available' ? 'Available' : 'Reserved'}</span>
          </div>
          <div class="muted">Owner: ${esc(l.owner.name)}${l.owner.location ? ' · ' + esc(l.owner.location) : ''}</div>
          <div class="muted">${stars(l.owner.rating)}</div>
          <div class="actions">
            ${l.status === 'available' ? `<button class="small" data-action="openRequest" data-id="${l.id}">${open ? 'Close' : 'Request swap'}</button>` : ''}
            <button class="small secondary" data-action="wishFromListing" data-id="${l.id}">♡ Wishlist</button>
            <button class="small secondary" data-action="message" data-user="${l.ownerId}" data-listing="${l.id}">✉ Message</button>
          </div>
          ${open ? `
            <form data-form="requestSwap" data-id="${l.id}" class="inline-form stack">
              ${mine.length ? `
                <div><label>Book you offer</label>
                  <select name="offeredListingId" required>
                    ${mine.map((m) => `<option value="${m.id}">${esc(m.title)}</option>`).join('')}
                  </select></div>
                <div class="row">
                  <div class="grow"><label>Date</label><input type="date" name="date" min="${today}" required></div>
                  <div class="grow"><label>Time</label><input type="time" name="time" required></div>
                </div>
                <div><label>Meeting place</label><input name="place" placeholder="e.g. AUBH library entrance" required></div>
                <button type="submit" class="small">Send request</button>`
              : `<p class="muted">List one of your own books first so you have something to offer.
                   <a href="#mybooks">Add a book</a></p>`}
            </form>` : ''}
        </article>`;
    }).join('');

    return `
      <h1>Browse books</h1>
      <p class="sub">Books other swappers have listed near you.</p>
      <form data-form="browseFilter" class="card row" role="search">
        <div class="grow"><label for="bf-q">Search</label>
          <input id="bf-q" name="query" value="${esc(f.query)}" placeholder="Title, author or genre"></div>
        <div><label for="bf-g">Genre</label><select id="bf-g" name="genre" data-change="submit">${options(GENRES, f.genre, 'All')}</select></div>
        <div><label for="bf-c">Condition</label><select id="bf-c" name="condition" data-change="submit">${options(CONDITIONS, f.condition, 'Any')}</select></div>
        <div><label for="bf-s">Sort by</label>
          <select id="bf-s" name="sort" data-change="submit">
            <option value="newest" ${f.sort === 'newest' ? 'selected' : ''}>Newest</option>
            <option value="popular" ${f.sort === 'popular' ? 'selected' : ''}>Most popular</option>
            <option value="title" ${f.sort === 'title' ? 'selected' : ''}>Title A–Z</option>
          </select></div>
        <label class="check"><input type="checkbox" name="availableOnly" data-change="submit" ${f.availableOnly ? 'checked' : ''}> Available only</label>
        <button type="submit">Search</button>
      </form>
      <p class="muted">${list.length} book${list.length === 1 ? '' : 's'} found</p>
      ${list.length ? `<div class="grid">${cards}</div>` : '<div class="empty">No books match. Try a different search or clear the filters.</div>'}`;
  }

  function myBooksPage() {
    const list = store.myListings();
    const statusText = { available: 'Available', reserved: 'In a swap', swapped: 'Swapped' };
    return `
      <h1>My books</h1>
      <p class="sub">Books you own and are willing to swap.</p>
      <form data-form="createListing" class="card stack" novalidate>
        <h2 style="margin-top:0">List a new book</h2>
        <div class="row">
          <div class="grow"><label for="cl-t">Title *</label><input id="cl-t" name="title" required></div>
          <div class="grow"><label for="cl-a">Author *</label><input id="cl-a" name="author" required></div>
        </div>
        <div class="row">
          <div class="grow"><label for="cl-g">Genre *</label><select id="cl-g" name="genre" required>${options(GENRES, '', 'Choose…')}</select></div>
          <div class="grow"><label for="cl-c">Condition *</label><select id="cl-c" name="condition" required>${options(CONDITIONS, '', 'Choose…')}</select></div>
          <div class="grow"><label for="cl-i">ISBN (optional)</label><input id="cl-i" name="isbn" inputmode="numeric"></div>
        </div>
        <div><button type="submit">Add book</button></div>
      </form>
      <h2>Your listings (${list.length})</h2>
      ${list.length ? `<div class="grid">${list.map((l) => `
        <article class="card">
          <div class="book-title">${esc(l.title)}</div>
          <div class="muted">by ${esc(l.author)}</div>
          <div class="tags">
            <span class="tag">${esc(l.genre)}</span>
            <span class="tag">${esc(l.condition)}</span>
            <span class="tag ${l.status}">${statusText[l.status]}</span>
          </div>
          ${l.isbn ? `<div class="muted">ISBN ${esc(l.isbn)}</div>` : ''}
          <div class="muted">Listed ${fmtDate(l.createdAt)}</div>
          <div class="actions">
            <button class="small danger" data-action="deleteListing" data-id="${l.id}" data-title="${esc(l.title)}"
              ${l.status === 'reserved' ? 'disabled title="Cancel the swap first"' : ''}>Delete</button>
          </div>
        </article>`).join('')}</div>`
        : '<div class="empty">You haven\'t listed any books yet.</div>'}`;
  }

  function wishlistPage() {
    const f = view.wish;
    const items = store.getWishlist(f);
    const total = store.getWishlist({}).length;
    const acquired = store.getWishlist({}).filter((w) => w.acquired).length;

    return `
      <h1>My wishlist</h1>
      <p class="sub">${total} book${total === 1 ? '' : 's'} · ${acquired} got · ${total - acquired} still wanted</p>
      <form data-form="addWish" class="card stack" novalidate>
        <div class="row">
          <div class="grow"><label for="aw-t">Title *</label><input id="aw-t" name="title" required></div>
          <div class="grow"><label for="aw-a">Author</label><input id="aw-a" name="author"></div>
          <div><label for="aw-g">Genre</label><select id="aw-g" name="genre">${options(GENRES, 'Other')}</select></div>
          <div><label for="aw-p">Priority</label>
            <select id="aw-p" name="priority">
              <option value="high">High</option>
              <option value="medium" selected>Medium</option>
              <option value="low">Low</option>
            </select></div>
          <button type="submit">Add to wishlist</button>
        </div>
      </form>

      <form data-form="wishFilter" class="row" style="margin-top:14px" role="search">
        <div class="grow"><label for="wf-q">Search wishlist</label><input id="wf-q" name="query" value="${esc(f.query)}" placeholder="Title or author"></div>
        <div><label for="wf-g">Genre</label><select id="wf-g" name="genre" data-change="submit">${options(GENRES, f.genre, 'All')}</select></div>
        <div><label for="wf-s">Sort by</label>
          <select id="wf-s" name="sort" data-change="submit">
            <option value="priority" ${f.sort === 'priority' ? 'selected' : ''}>Priority</option>
            <option value="added" ${f.sort === 'added' ? 'selected' : ''}>Recently added</option>
            <option value="title" ${f.sort === 'title' ? 'selected' : ''}>Title A–Z</option>
          </select></div>
        <label class="check"><input type="checkbox" name="hideAcquired" data-change="submit" ${f.hideAcquired ? 'checked' : ''}> Hide books I got</label>
        <label class="check"><input type="checkbox" name="availableOnly" data-change="submit" ${f.availableOnly ? 'checked' : ''}> Available to swap</label>
        <button type="submit" class="secondary">Apply</button>
      </form>

      <div class="stack" style="margin-top:14px">
        ${items.length ? items.map((w) => `
          <div class="card wish-item ${w.acquired ? 'done' : ''}">
            <span class="prio ${w.priority}" aria-hidden="true"></span>
            <label class="check" title="Mark as got">
              <input type="checkbox" data-change="toggleAcquired" data-id="${w.id}" ${w.acquired ? 'checked' : ''}
                aria-label="Got ${esc(w.title)}">
            </label>
            <div class="info">
              <div class="book-title">${esc(w.title)}</div>
              <div class="muted">${w.author ? 'by ' + esc(w.author) + ' · ' : ''}${esc(w.genre)}</div>
              ${w.availableListingId && !w.acquired ? `<span class="tag available">Someone is offering this</span>` : ''}
            </div>
            <select data-change="priority" data-id="${w.id}" aria-label="Priority for ${esc(w.title)}">
              <option value="high" ${w.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="medium" ${w.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="low" ${w.priority === 'low' ? 'selected' : ''}>Low</option>
            </select>
            ${w.availableListingId && !w.acquired ? `<button class="small" data-action="findOffer" data-title="${esc(w.title)}">Find it</button>` : ''}
            <button class="small danger" data-action="removeWish" data-id="${w.id}" aria-label="Remove ${esc(w.title)}">✕</button>
          </div>`).join('')
        : `<div class="empty">${total ? 'Nothing matches these filters.' : 'Your wishlist is empty. Add a book you\'re looking for.'}</div>`}
      </div>`;
  }

  function swapCard(x) {
    const step = (p, label) => p ? `✅ ${label}` : `⬜ Not ${label.toLowerCase()} yet`;
    const today = new Date().toISOString().slice(0, 10);
    const canChange = ['pending', 'accepted'].includes(x.status);

    let body = '';
    if (x.status === 'pending' && x.role === 'owner') {
      body = `<div class="actions">
          <button class="small" data-action="respond" data-id="${x.id}" data-accept="1">Accept</button>
          <button class="small danger" data-action="respond" data-id="${x.id}" data-accept="0">Reject</button>
        </div>`;
    } else if (x.status === 'pending') {
      body = `<div class="actions"><button class="small danger" data-action="cancelSwap" data-id="${x.id}">Cancel request</button></div>`;
    } else if (x.status === 'accepted') {
      body = `
        <div class="progress">
          <div class="side">
            <strong>You</strong>
            <label class="check"><input type="checkbox" data-change="completion" data-flag="handedOver" data-id="${x.id}" ${x.me.handedOver ? 'checked' : ''}> I handed over my book</label>
            <label class="check"><input type="checkbox" data-change="completion" data-flag="received" data-id="${x.id}" ${x.me.received ? 'checked' : ''}> I received their book</label>
          </div>
          <div class="side">
            <strong>${esc(x.other.name)}</strong>
            <div class="muted">${step(x.them.handedOver, 'Handed over')}</div>
            <div class="muted">${step(x.them.received, 'Received')}</div>
          </div>
        </div>
        <div class="actions">
          <button class="small secondary" data-action="openReport" data-id="${x.id}">Report a problem</button>
          <button class="small danger" data-action="cancelSwap" data-id="${x.id}">Cancel swap</button>
        </div>`;
    } else if (x.status === 'completed') {
      body = x.reviewed ? '<p class="muted">Thanks, you rated this swap.</p>' : `
        <form data-form="review" data-id="${x.id}" class="inline-form stack">
          <label>Rate your swap with ${esc(x.other.name)}</label>
          <div class="star-input">
            ${[5, 4, 3, 2, 1].map((n) => `
              <input type="radio" id="r-${x.id}-${n}" name="rating" value="${n}">
              <label for="r-${x.id}-${n}" title="${n} star${n > 1 ? 's' : ''}">★</label>`).join('')}
          </div>
          <textarea name="comment" placeholder="What went well or badly? (optional)"></textarea>
          <div><button type="submit" class="small">Submit review</button>
          <button type="button" class="small secondary" data-action="openReport" data-id="${x.id}">Report a problem</button></div>
        </form>`;
    } else if (x.status === 'problem' && x.problem) {
      body = `<p class="muted">Reported: ${esc(x.problem.reason)}${x.problem.details ? ' – ' + esc(x.problem.details) : ''}</p>`;
    }

    const report = view.reporting === x.id ? `
      <form data-form="report" data-id="${x.id}" class="inline-form stack">
        <div><label>What went wrong?</label><select name="reason" required>${options(PROBLEM_REASONS, '', 'Choose a reason…')}</select></div>
        <div><label>Details</label><textarea name="details"></textarea></div>
        <div><button type="submit" class="small danger">Submit report</button></div>
      </form>` : '';

    const resched = view.rescheduling === x.id ? `
      <form data-form="reschedule" data-id="${x.id}" class="inline-form stack">
        <div class="row">
          <div class="grow"><label>Date</label><input type="date" name="date" min="${today}" value="${x.meeting.date}" required></div>
          <div class="grow"><label>Time</label><input type="time" name="time" value="${x.meeting.time}" required></div>
        </div>
        <div><label>Place</label><input name="place" value="${esc(x.meeting.place)}" required></div>
        <div><button type="submit" class="small">Save changes</button></div>
      </form>` : '';

    const title = (l) => (l ? esc(l.title) : '<span class="muted">Removed</span>');
    return `
      <article class="card">
        <div class="spread">
          <div><strong>${x.role === 'owner' ? `${esc(x.other.name)} wants your book` : `Your request to ${esc(x.other.name)}`}</strong>
            <div class="muted">${stars(x.other.rating)}</div></div>
          <span class="tag ${x.status}">${STATUS_TEXT[x.status]}</span>
        </div>
        <div class="swap-books">
          <div><div class="muted">${x.role === 'owner' ? 'You give' : 'You get'}</div><div class="book-title">${title(x.target)}</div></div>
          <div class="arrow">⇄</div>
          <div><div class="muted">${x.role === 'owner' ? 'You get' : 'You give'}</div><div class="book-title">${title(x.offered)}</div></div>
        </div>
        ${x.other.id ? `<div class="actions"><button class="small secondary" data-action="message" data-user="${x.other.id}"
          data-listing="${x.role === 'owner' ? (x.offered ? x.offered.id : '') : (x.target ? x.target.id : '')}">✉ Message ${esc(x.other.name.split(' ')[0])}</button></div>` : ''}
        <div class="muted">📍 ${fmtMeeting(x.meeting)}
          ${canChange ? ` · <a href="#" data-action="openReschedule" data-id="${x.id}">Change</a>` : ''}</div>
        ${body}${resched}${report}
      </article>`;
  }

  function swapsPage() {
    const all = store.getMyExchanges();
    const incoming = all.filter((x) => x.status === 'pending' && x.role === 'owner');
    const outgoing = all.filter((x) => x.status === 'pending' && x.role === 'requester');
    const active = all.filter((x) => x.status === 'accepted');
    const past = all.filter((x) => !['pending', 'accepted'].includes(x.status));
    const section = (title, list, emptyMsg) => `
      <h2>${title} (${list.length})</h2>
      ${list.length ? `<div class="stack">${list.map(swapCard).join('')}</div>` : `<div class="empty">${emptyMsg}</div>`}`;

    return `
      <h1>My swaps</h1>
      <p class="sub">Accept requests, track handover and confirm when each swap is done.</p>
      ${section('Requests for your books', incoming, 'No one has requested your books yet.')}
      ${section('Active swaps', active, 'No swaps in progress.')}
      ${section('Requests you sent', outgoing, 'Find a book on Browse and request a swap.')}
      ${section('History', past, 'Finished swaps will show up here.')}`;
  }

  function messagesPage(user) {
    // Pick the conversation, mark it read, then build the list so badges are up to date
    if (!view.chatWith && window.innerWidth > 760) {
      const first = store.getConversations()[0];
      if (first) view.chatWith = first.otherId;
    }
    if (view.chatWith && !store.publicProfile(view.chatWith)
        && !store.getConversations().some((c) => c.otherId === view.chatWith)) view.chatWith = null;
    const thread = view.chatWith ? store.openThread(view.chatWith) : [];

    const convos = store.getConversations();
    // Opening a chat with someone new shows them even before the first message
    if (view.chatWith && !convos.some((c) => c.otherId === view.chatWith)) {
      convos.unshift({ otherId: view.chatWith, other: store.publicProfile(view.chatWith), last: null, unread: 0 });
    }
    const active = convos.find((c) => c.otherId === view.chatWith);
    const time = (ts) => {
      const d = new Date(ts);
      const today = new Date().toDateString() === d.toDateString();
      return today ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    };
    const about = view.chatAbout ? (store.browseListings({}).concat(store.myListings()).find((l) => l.id === view.chatAbout)) : null;

    let lastTag = null;
    const bubbles = thread.map((m) => {
      const tag = m.listingTitle && m.listingId !== lastTag
        ? `<div class="about-chip">📖 About: ${esc(m.listingTitle)}</div>` : '';
      if (m.listingId) lastTag = m.listingId;
      return `${tag}<div class="bubble ${m.mine ? 'mine' : 'theirs'}">
          <div class="bubble-text">${esc(m.text)}</div>
          <div class="bubble-time">${time(m.at)}${m.mine ? (m.read ? ' · Seen' : ' · Sent') : ''}</div>
        </div>`;
    }).join('');

    return `
      <h1>Messages</h1>
      <p class="sub">Arrange swaps, meeting times and places with other swappers.</p>
      <div class="chat-layout ${active ? 'has-active' : ''}">
        <aside class="card chat-list" aria-label="Conversations">
          ${convos.length ? convos.map((c) => `
            <button class="chat-row ${c.otherId === view.chatWith ? 'active' : ''}" data-action="openChat" data-user="${c.otherId}">
              ${avatar(c.other, 'sm')}
              <span class="chat-row-text">
                <span class="chat-row-top"><strong>${esc(c.other.name)}</strong>
                  ${c.last ? `<span class="hint">${time(c.last.at)}</span>` : ''}</span>
                <span class="chat-preview">${c.last ? (c.last.fromId === user.id ? 'You: ' : '') + esc(c.last.text) : 'New conversation'}</span>
              </span>
              ${c.unread ? `<span class="badge-count">${c.unread}</span>` : ''}
            </button>`).join('')
          : '<p class="muted" style="padding:12px">No messages yet. Tap ✉ Message on any book to contact its owner.</p>'}
        </aside>

        <section class="card chat-panel">
          ${active ? `
            <header class="chat-head">
              <button class="small secondary chat-back" data-action="closeChat" aria-label="Back to conversations">←</button>
              ${avatar(active.other, 'sm')}
              <div><strong>${esc(active.other.name)}</strong>
                <div class="hint">${active.other.location ? esc(active.other.location) + ' · ' : ''}${active.other.rating == null ? 'No ratings yet' : '★ ' + active.other.rating}</div></div>
            </header>
            <div class="chat-body" id="chat-body">
              ${bubbles || '<p class="muted center">Say hello and ask about the book.</p>'}
            </div>
            <form data-form="sendMessage" class="chat-input">
              ${about ? `<div class="about-chip sending">📖 About: ${esc(about.title)}
                <button type="button" class="link-btn" data-action="clearAbout" aria-label="Remove book link">✕</button></div>` : ''}
              <div class="chat-send-row">
                <textarea id="chat-text" name="text" rows="1" maxlength="1000" placeholder="Write a message…" data-input="draft">${esc(view.draft)}</textarea>
                <button type="submit">Send</button>
              </div>
            </form>`
          : '<div class="empty" style="margin:auto">Choose a conversation.</div>'}
        </section>
      </div>`;
  }

  function profilePage(user) {
    const reviews = store.reviewsFor(user.id);
    const ago = (ts) => {
      const days = Math.floor((Date.now() - ts) / 86400000);
      if (days < 1) return 'today';
      if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
      const m = Math.floor(days / 30);
      return `${m} month${m === 1 ? '' : 's'} ago`;
    };
    return `
      <div class="profile-layout">
        <aside class="card side-card">
          ${avatar(user, 'lg')}
          <div class="side-name">${esc(user.name)}</div>
          <div class="side-loc">${esc(user.location || 'Add your area')}</div>
          <div class="side-rating">${stars(user.rating)} · ${user.swapCount} swap${user.swapCount === 1 ? '' : 's'}</div>
          <nav class="side-menu" aria-label="Account menu">
            <a href="#profile" class="active">Profile</a>
            <a href="#mybooks">My listings</a>
            <a href="#wishlist">Wishlist</a>
            <a href="#swaps">Exchanges</a>
            <a href="#messages">Messages</a>
            <a href="#" data-action="signOut" class="signout">Sign out</a>
          </nav>
        </aside>

        <div class="stack-lg">
          <div>
            <h1>Profile</h1>
            <p class="sub">This is what other swappers will see on your public profile.</p>
          </div>

          <form data-form="profile" class="card stack">
            <div class="photo-row">
              ${avatar(user, 'md')}
              <div>
                <label class="btn btn-lilac" for="pf-photo">Upload Photo</label>
                <input id="pf-photo" type="file" accept="image/png,image/jpeg" data-change="photo" class="visually-hidden">
                ${user.photo ? '<button type="button" class="link-btn" data-action="removePhoto">Remove</button>' : ''}
                <div class="hint">JPG or PNG, up to 5 MB</div>
              </div>
            </div>
            <div class="two-col">
              <div><label for="pf-n">Full Name</label><input id="pf-n" name="name" value="${esc(user.name)}" placeholder="Enter your name." required></div>
              <div><label for="pf-l">General Area</label><input id="pf-l" name="location" value="${esc(user.location)}" placeholder="City"></div>
            </div>
            <div>
              <label for="pf-e">Email (private)</label>
              <input id="pf-e" value="${esc(user.email)}" readonly>
              <div class="hint">Only you can see your email. Other users see your name, area, rating and books.</div>
            </div>
            <div><label for="pf-b">Bio</label><textarea id="pf-b" name="bio" maxlength="300" placeholder="Tell other readers what you like to read…">${esc(user.bio)}</textarea></div>
            <div class="actions">
              <button type="submit">Save changes</button>
              <button type="reset" class="secondary">Cancel</button>
            </div>
          </form>

          <div class="card stack">
            <div class="spread">
              <div><h2 class="card-title">Password &amp; security</h2>
                <div class="muted">Password · last changed ${ago(user.passwordChangedAt)}</div></div>
              <button class="secondary" data-action="openPassword">${view.changingPassword ? 'Close' : 'Change password'}</button>
            </div>
            ${view.changingPassword ? `
              <form data-form="changePassword" class="stack inline-form">
                <div><label for="cp-o">Current password</label><input id="cp-o" name="oldPassword" type="password" autocomplete="current-password" required></div>
                <div><label for="cp-n">New password (at least 8 characters)</label><input id="cp-n" name="newPassword" type="password" autocomplete="new-password" required></div>
                <div><button type="submit">Update password</button></div>
              </form>` : ''}
          </div>

          <div class="card stack">
            <h2 class="card-title">Reviews (${user.reviewCount})</h2>
            ${reviews.length ? reviews.map((r) => `
              <div class="review">
                <div>${stars(r.rating)} <span class="muted">from ${esc(r.reviewer)} · ${fmtDate(r.createdAt)}</span></div>
                ${r.comment ? `<div>${esc(r.comment)}</div>` : ''}
              </div>`).join('') : '<p class="muted">Complete a swap to get your first review.</p>'}
          </div>

          <form data-form="deleteAccount" class="card card-dashed stack">
            <h2 class="card-title">Delete account</h2>
            <p class="muted">Deleting your account removes your listings and cancels any open exchanges. This cannot be undone.</p>
            <div class="row">
              <div class="grow"><label for="da-p">Confirm with your password</label><input id="da-p" name="password" type="password" autocomplete="current-password" required></div>
              <button type="submit" class="danger">Delete account</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  const pages = {
    signin: signinPage, register: registerPage,
    browse: browsePage, mybooks: myBooksPage, wishlist: wishlistPage,
    swaps: swapsPage, messages: messagesPage, profile: profilePage
  };
  const PUBLIC = ['signin', 'register'];

  function render() {
    const user = store.currentUser();
    let page = location.hash.replace(/^#\/?/, '') || '';
    if (!pages[page]) page = user ? 'browse' : 'signin';
    if (!user && !PUBLIC.includes(page)) page = 'signin';   // restricted pages need sign-in
    if (user && PUBLIC.includes(page)) page = 'browse';
    if (location.hash !== '#' + page) history.replaceState(null, '', '#' + page);

    document.body.classList.toggle('auth-mode', !user);
    $app.innerHTML = pages[page](user);
    renderNav(user, page);
    const body = document.getElementById('chat-body');
    if (body) body.scrollTop = body.scrollHeight;
  }

  /* ---------- Form submissions ---------- */

  const forms = {
    signIn: (d) => {
      if (!run(() => store.signIn(d.email, d.password, d.remember === 'on'), 'Welcome back!')) return;
      view.forgotOpen = false;
      go('browse');
    },
    register: (d) => {
      if (!run(() => store.register(d), 'Account created. Welcome to SwapCycle!')) return;
      go('browse');
    },

    browseFilter: (d) => {
      Object.assign(view.browse, d, { availableOnly: d.availableOnly === 'on' });
      render();
    },

    requestSwap: (d, form) => {
      if (run(() => store.requestExchange({ listingId: form.dataset.id, ...d }), 'Swap request sent.')) {
        view.requesting = null;
        render();
      }
    },

    createListing: (d) => run(() => store.createListing(d), 'Book listed.'),

    addWish: (d) => run(() => store.addToWishlist(d), 'Added to your wishlist.'),
    wishFilter: (d) => {
      Object.assign(view.wish, d, { hideAcquired: d.hideAcquired === 'on', availableOnly: d.availableOnly === 'on' });
      render();
    },

    review: (d, form) => {
      if (!d.rating) return toast('Pick a star rating first.', 'error');
      run(() => store.addReview(form.dataset.id, d.rating, d.comment), 'Thanks for your review!');
    },
    report: (d, form) => {
      if (run(() => store.reportProblem(form.dataset.id, d.reason, d.details), 'Problem reported.')) {
        view.reporting = null;
        render();
      }
    },
    reschedule: (d, form) => {
      if (run(() => store.updateMeeting(form.dataset.id, d), 'Meeting updated.')) {
        view.rescheduling = null;
        render();
      }
    },

    sendMessage: (d) => {
      const ok = run(() => {
        store.sendMessage(view.chatWith, d.text, view.chatAbout);
        view.draft = '';
        view.chatAbout = null;
      });
      if (ok) {
        const box = document.getElementById('chat-text');
        if (box) box.focus();
      }
    },
    profile: (d) => run(() => store.updateProfile(d), 'Profile saved.'),
    changePassword: (d) => {
      if (run(() => store.changePassword(d.oldPassword, d.newPassword), 'Password updated.')) {
        view.changingPassword = false;
        render();
      }
    },
    deleteAccount: (d) => {
      ask('Delete your SwapCycle account permanently?', () => {
        run(() => store.deleteAccount(d.password), 'Your account was deleted.') && go('signin');
      });
    }
  };

  /* ---------- Button clicks ---------- */

  const toggle = (key, id) => { view[key] = view[key] === id ? null : id; render(); };

  const actions = {
    message: (ds) => {
      view.chatWith = ds.user;
      view.chatAbout = ds.listing || null;
      view.draft = '';
      go('messages');
    },
    openChat: (ds) => {
      if (view.chatWith !== ds.user) { view.draft = ''; view.chatAbout = null; }
      view.chatWith = ds.user;
      render();
    },
    closeChat: () => { view.chatWith = null; render(); },
    clearAbout: () => { view.chatAbout = null; render(); },
    forgot: () => { view.forgotOpen = !view.forgotOpen; render(); },
    signOut: () => { store.signOut(); go('signin'); render(); },
    seed: () => {
      try {
        const n = store.seedDemo();
        toast(n ? 'Demo accounts loaded: layla@example.com and omar@example.com' : 'Demo accounts already exist.');
      } catch (e) { toast(e.message, 'error'); }
    },
    openRequest: (ds) => toggle('requesting', ds.id),
    wishFromListing: (ds) => run(() => store.addListingToWishlist(ds.id), 'Added to your wishlist.'),
    deleteListing: (ds) => {
      ask(`Delete "${ds.title}" from your listings?`, () => run(() => store.deleteListing(ds.id), 'Listing deleted.'));
    },
    removeWish: (ds) => run(() => store.removeFromWishlist(ds.id), 'Removed from wishlist.'),
    findOffer: (ds) => {
      Object.assign(view.browse, { query: ds.title, genre: '', condition: '', availableOnly: true });
      go('browse');
    },
    respond: (ds) => run(() => store.respondToExchange(ds.id, ds.accept === '1'),
      ds.accept === '1' ? 'Swap accepted. Both books are now reserved.' : 'Request rejected.'),
    cancelSwap: (ds) => {
      ask('Cancel this swap?', () => run(() => store.cancelExchange(ds.id), 'Swap cancelled.'));
    },
    openReport: (ds) => toggle('reporting', ds.id),
    openReschedule: (ds) => toggle('rescheduling', ds.id),
    openPassword: () => { view.changingPassword = !view.changingPassword; render(); },
    removePhoto: () => run(() => store.setPhoto(''), 'Photo removed.')
  };

  /* ---------- Select / checkbox changes ---------- */

  const changes = {
    submit: (el) => el.form.requestSubmit(),
    photo: (el) => {
      const file = el.files && el.files[0];
      if (!file) return;
      readPhoto(file)
        .then((url) => run(() => store.setPhoto(url), 'Photo updated.'))
        .catch((e) => toast(e.message, 'error'));
    },
    priority: (el) => run(() => store.setWishPriority(el.dataset.id, el.value), 'Priority updated.'),
    toggleAcquired: (el) => run(() => store.toggleWishAcquired(el.dataset.id)),
    completion: (el) => {
      const before = store.getMyExchanges().find((x) => x.id === el.dataset.id);
      run(() => store.toggleCompletion(el.dataset.id, el.dataset.flag));
      const after = store.getMyExchanges().find((x) => x.id === el.dataset.id);
      if (before && after && before.status !== 'completed' && after.status === 'completed') {
        toast('Swap completed! You can now rate it.');
      }
    }
  };

  /* ---------- Event wiring ---------- */

  function bindEvents(root) {
    root.addEventListener('submit', (e) => {
      const form = e.target.closest('form[data-form]');
      if (!form || !forms[form.dataset.form]) return;
      e.preventDefault();
      forms[form.dataset.form](Object.fromEntries(new FormData(form)), form);
    });
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !actions[el.dataset.action]) return;
      e.preventDefault();
      actions[el.dataset.action](el.dataset, el);
    });
    root.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (!el || !changes[el.dataset.change]) return;
      changes[el.dataset.change](el);
    });
  }

  bindEvents($app);
  bindEvents($nav);
  window.addEventListener('hashchange', () => { render(); $app.focus(); });

  // Another tab changed the shared data (new message, swap accepted...):
  // reload it and redraw, keeping what is being typed in the chat box
  window.addEventListener('storage', (e) => {
    if (e.key !== window.SwapCycle.STORAGE_KEY) return;
    const box = document.getElementById('chat-text');
    const typing = box && document.activeElement === box;
    const caret = typing ? box.selectionStart : null;
    store.refresh();
    render();
    const again = document.getElementById('chat-text');
    if (typing && again) { again.focus(); again.setSelectionRange(caret, caret); }
  });

  // Enter sends, Shift+Enter makes a new line; the text is saved as a draft while typing
  $app.addEventListener('input', (e) => {
    if (e.target.dataset.input === 'draft') view.draft = e.target.value;
  });
  $app.addEventListener('keydown', (e) => {
    if (e.target.id === 'chat-text' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.target.form.requestSubmit();
    }
  });

  render();
})();
