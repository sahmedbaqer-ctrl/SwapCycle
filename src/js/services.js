/*
 * SwapCycle core logic: accounts, book listings, wishlist, exchanges and reviews.
 * Everything is kept in one JSON object saved to localStorage, so data survives
 * page reloads and closing the browser. The server and PostgreSQL database from
 * the architecture diagram replace this layer later.
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'swapcycle.data.v1';
  const TAB_SESSION_KEY = 'swapcycle.session';        // per tab (sessionStorage)
  const REMEMBERED_KEY = 'swapcycle.rememberedUser';  // "Remember me" (localStorage)
  const MAX_FAILED_SIGNINS = 5;
  const LOCK_MINUTES = 15;
  const MIN_PASSWORD = 8;

  const GENRES = ['Fiction', 'Non-fiction', 'Fantasy', 'Science', 'History',
    'Biography', 'Self-help', 'Romance', 'Mystery', 'Children', 'Other'];
  const CONDITIONS = ['New', 'Good', 'Used'];
  const PRIORITIES = { high: 3, medium: 2, low: 1 };
  const PROBLEM_REASONS = ['Wrong book received', 'Book not received',
    'Book in worse condition than listed', 'Other user did not show up', 'Other'];

  class AppError extends Error {}
  const fail = (msg) => { throw new AppError(msg); };

  // Used when localStorage isn't available (private mode, Node)
  function memoryStorage() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k)
    };
  }

  function emptyState() {
    return { users: [], listings: [], wishlist: [], exchanges: [], reviews: [], messages: [], session: null };
  }

  // Simple FNV-1a hash so plain passwords are never stored.
  // Proper salted hashing (bcrypt) moves to the server in a later sprint.
  function hashPassword(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  const uid = (prefix) => prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clean = (v) => String(v == null ? '' : v).trim();
  const same = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();

  /*
   * storage    = shared data for every tab (localStorage): users, books, swaps, reviews
   * tabStorage = who is signed in on THIS tab (sessionStorage), so two tabs
   *              can be signed in as two different users at the same time
   */
  function createStore(storage, clock, tabStorage) {
    storage = storage || memoryStorage();
    tabStorage = tabStorage || memoryStorage();
    const now = clock || (() => Date.now());
    let state = load();
    state.session = restoreSession();

    // This tab's own sign-in first; otherwise the account saved with "Remember me"
    function restoreSession() {
      const id = tabStorage.getItem(TAB_SESSION_KEY) || storage.getItem(REMEMBERED_KEY);
      if (!id || !state.users.some((u) => u.id === id)) return null;
      tabStorage.setItem(TAB_SESSION_KEY, id);
      return id;
    }

    function setSession(id, remember) {
      const remembered = storage.getItem(REMEMBERED_KEY);
      if (id) {
        tabStorage.setItem(TAB_SESSION_KEY, id);
        if (remember) storage.setItem(REMEMBERED_KEY, id);
        else if (remembered === id) storage.removeItem(REMEMBERED_KEY);
      } else {
        tabStorage.removeItem(TAB_SESSION_KEY);
        if (remembered && remembered === state.session) storage.removeItem(REMEMBERED_KEY);
      }
      state.session = id;
    }

    // Another tab changed the shared data: reload it but keep this tab's user
    function refresh() {
      const keep = state.session;
      state = load();
      state.session = state.users.some((u) => u.id === keep) ? keep : null;
      if (!state.session) tabStorage.removeItem(TAB_SESSION_KEY);
    }

    function load() {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return emptyState();
        return Object.assign(emptyState(), JSON.parse(raw));
      } catch (e) {
        return emptyState(); // corrupted data: start fresh instead of crashing
      }
    }

    function save() {
      // The signed-in user is per tab, so it is not written to the shared data
      storage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({}, state, { session: null })));
    }

    function currentUser() {
      return state.users.find((u) => u.id === state.session) || null;
    }

    function requireUser() {
      const u = currentUser();
      if (!u) fail('Please sign in first.');
      return u;
    }

    const findUser = (id) => state.users.find((u) => u.id === id) || null;
    const findListing = (id) => state.listings.find((l) => l.id === id) || null;
    const findExchange = (id) => state.exchanges.find((x) => x.id === id) || null;

    function averageRating(userId) {
      const r = state.reviews.filter((v) => v.revieweeId === userId);
      if (!r.length) return null;
      return Math.round((r.reduce((s, v) => s + v.rating, 0) / r.length) * 10) / 10;
    }

    function publicProfile(userId) {
      const u = findUser(userId);
      if (!u) return null;
      return {
        id: u.id,
        name: u.name,
        location: u.location,
        bio: u.bio,
        photo: u.photo || '',
        rating: averageRating(u.id),
        reviewCount: state.reviews.filter((v) => v.revieweeId === u.id).length,
        swapCount: state.exchanges.filter((x) =>
          x.status === 'completed' && (x.requesterId === u.id || x.ownerId === u.id)).length
      };
    }

    /* ---------- Accounts ---------- */

    function register({ name, email, password }) {
      name = clean(name);
      email = clean(email).toLowerCase();
      password = String(password || '');
      if (!name) fail('Please enter your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Please enter a valid email address.');
      if (password.length < MIN_PASSWORD) fail(`Password must be at least ${MIN_PASSWORD} characters.`);
      if (state.users.some((u) => u.email === email)) fail('An account with this email already exists.');

      const user = {
        id: uid('u'), name, email,
        passwordHash: hashPassword(password),
        location: '', bio: '',
        failedSignIns: 0, lockedUntil: null,
        createdAt: now()
      };
      state.users.push(user);
      save();
      setSession(user.id, true);
      return publicProfile(user.id);
    }

    function signIn(email, password, remember = true) {
      email = clean(email).toLowerCase();
      const user = state.users.find((u) => u.email === email);
      // Same message for unknown email and wrong password, so emails can't be guessed
      if (!user) fail('Incorrect email or password.');

      if (user.lockedUntil && now() < user.lockedUntil) {
        const mins = Math.ceil((user.lockedUntil - now()) / 60000);
        fail(`Account locked after too many failed attempts. Try again in ${mins} minute(s).`);
      }

      if (user.passwordHash !== hashPassword(String(password || ''))) {
        user.failedSignIns += 1;
        if (user.failedSignIns >= MAX_FAILED_SIGNINS) {
          user.lockedUntil = now() + LOCK_MINUTES * 60000;
          user.failedSignIns = 0;
          save();
          fail(`Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`);
        }
        save();
        fail('Incorrect email or password.');
      }

      user.failedSignIns = 0;
      user.lockedUntil = null;
      save();
      setSession(user.id, remember);
      return publicProfile(user.id);
    }

    function signOut() {
      setSession(null);
    }

    function updateProfile({ name, location, bio }) {
      const u = requireUser();
      if (name !== undefined) {
        if (!clean(name)) fail('Name cannot be empty.');
        u.name = clean(name);
      }
      if (location !== undefined) u.location = clean(location).slice(0, 80);
      if (bio !== undefined) u.bio = clean(bio).slice(0, 300);
      save();
      return publicProfile(u.id);
    }

    // Photo arrives already shrunk by the UI, stored as a small data URL
    function setPhoto(dataUrl) {
      const u = requireUser();
      if (dataUrl && !/^data:image\/(png|jpeg);base64,/.test(dataUrl)) fail('Photo must be a JPG or PNG.');
      if (dataUrl && dataUrl.length > 400000) fail('Photo is too large.');
      u.photo = dataUrl || '';
      save();
      return publicProfile(u.id);
    }

    function changePassword(oldPassword, newPassword) {
      const u = requireUser();
      if (u.passwordHash !== hashPassword(String(oldPassword || ''))) fail('Current password is incorrect.');
      newPassword = String(newPassword || '');
      if (newPassword.length < MIN_PASSWORD) fail(`New password must be at least ${MIN_PASSWORD} characters.`);
      if (newPassword === oldPassword) fail('New password must be different from the current one.');
      u.passwordHash = hashPassword(newPassword);
      u.passwordChangedAt = now();
      save();
    }

    function deleteAccount(password) {
      const u = requireUser();
      if (u.passwordHash !== hashPassword(String(password || ''))) fail('Password is incorrect.');

      // Cancel any open exchange this user is part of and free the other person's book
      state.exchanges.forEach((x) => {
        if ((x.requesterId === u.id || x.ownerId === u.id) && ['pending', 'accepted'].includes(x.status)) {
          x.status = 'cancelled';
          x.closedAt = now();
          releaseListings(x);
        }
      });
      state.listings = state.listings.filter((l) => l.ownerId !== u.id);
      state.wishlist = state.wishlist.filter((w) => w.userId !== u.id);
      state.users = state.users.filter((x) => x.id !== u.id);
      save();
      setSession(null);
    }

    /* ---------- Book listings ---------- */

    function createListing({ title, author, genre, condition, isbn }) {
      const u = requireUser();
      title = clean(title);
      author = clean(author);
      isbn = clean(isbn).replace(/[-\s]/g, '');
      if (!title) fail('Title is required.');
      if (!author) fail('Author is required.');
      if (!GENRES.includes(genre)) fail('Please choose a genre.');
      if (!CONDITIONS.includes(condition)) fail('Please choose the book condition.');
      if (isbn && !/^(\d{9}[\dXx]|\d{13})$/.test(isbn)) fail('ISBN must be 10 or 13 digits.');

      const listing = {
        id: uid('b'), ownerId: u.id, title, author, genre, condition, isbn,
        status: 'available', // available | reserved | swapped
        createdAt: now()
      };
      state.listings.push(listing);
      save();
      return listing;
    }

    function deleteListing(id) {
      const u = requireUser();
      const l = findListing(id);
      if (!l) fail('Listing not found.');
      if (l.ownerId !== u.id) fail('You can only delete your own listings.');
      if (l.status === 'reserved') fail('This book is part of an accepted swap. Cancel the swap first.');

      // Any pending request involving this book can no longer happen
      state.exchanges.forEach((x) => {
        if (x.status === 'pending' && (x.listingId === id || x.offeredListingId === id)) {
          x.status = 'cancelled';
          x.closedAt = now();
        }
      });
      state.listings = state.listings.filter((x) => x.id !== id);
      save();
    }

    function popularity(listing) {
      const wanted = state.wishlist.filter((w) => same(w.title, listing.title)).length;
      const requests = state.exchanges.filter((x) => x.listingId === listing.id).length;
      return wanted + requests;
    }

    function withOwner(l) {
      return Object.assign({}, l, { owner: publicProfile(l.ownerId), popularity: popularity(l) });
    }

    // Browse other people's books with search, filters and sorting
    function browseListings({ query = '', genre = '', condition = '', availableOnly = false, sort = 'newest' } = {}) {
      const u = currentUser();
      const q = clean(query).toLowerCase();
      let list = state.listings.filter((l) => !u || l.ownerId !== u.id);
      list = list.filter((l) => l.status !== 'swapped');
      if (q) {
        list = list.filter((l) =>
          l.title.toLowerCase().includes(q) ||
          l.author.toLowerCase().includes(q) ||
          l.genre.toLowerCase().includes(q));
      }
      if (genre) list = list.filter((l) => l.genre === genre);
      if (condition) list = list.filter((l) => l.condition === condition);
      if (availableOnly) list = list.filter((l) => l.status === 'available');

      list = list.map(withOwner);
      if (sort === 'popular') list.sort((a, b) => b.popularity - a.popularity || b.createdAt - a.createdAt);
      else if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
      else list.sort((a, b) => b.createdAt - a.createdAt);
      return list;
    }

    function myListings() {
      const u = requireUser();
      return state.listings
        .filter((l) => l.ownerId === u.id)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(withOwner);
    }

    /* ---------- Wishlist ---------- */

    function addToWishlist({ title, author, genre, priority = 'medium' }) {
      const u = requireUser();
      title = clean(title);
      author = clean(author);
      if (!title) fail('Title is required.');
      if (!PRIORITIES[priority]) fail('Invalid priority.');
      const dup = state.wishlist.some((w) => w.userId === u.id && same(w.title, title) && same(w.author, author));
      if (dup) fail('This book is already on your wishlist.');

      const item = {
        id: uid('w'), userId: u.id, title, author,
        genre: GENRES.includes(genre) ? genre : 'Other',
        priority, acquired: false, acquiredAt: null,
        addedAt: now()
      };
      state.wishlist.push(item);
      save();
      return item;
    }

    function addListingToWishlist(listingId) {
      const l = findListing(listingId);
      if (!l) fail('Listing not found.');
      return addToWishlist({ title: l.title, author: l.author, genre: l.genre, priority: 'medium' });
    }

    function ownWishItem(id) {
      const u = requireUser();
      const w = state.wishlist.find((x) => x.id === id);
      if (!w || w.userId !== u.id) fail('Wishlist item not found.');
      return w;
    }

    function removeFromWishlist(id) {
      ownWishItem(id);
      state.wishlist = state.wishlist.filter((w) => w.id !== id);
      save();
    }

    function setWishPriority(id, priority) {
      if (!PRIORITIES[priority]) fail('Invalid priority.');
      const w = ownWishItem(id);
      w.priority = priority;
      save();
      return w;
    }

    function toggleWishAcquired(id) {
      const w = ownWishItem(id);
      w.acquired = !w.acquired;
      w.acquiredAt = w.acquired ? now() : null;
      save();
      return w;
    }

    function getWishlist({ query = '', genre = '', sort = 'priority', hideAcquired = false, availableOnly = false } = {}) {
      const u = requireUser();
      const q = clean(query).toLowerCase();
      let items = state.wishlist.filter((w) => w.userId === u.id).map((w) => {
        const match = state.listings.find((l) =>
          l.ownerId !== u.id && l.status === 'available' && same(l.title, w.title));
        return Object.assign({}, w, { availableListingId: match ? match.id : null });
      });

      if (q) items = items.filter((w) => w.title.toLowerCase().includes(q) || w.author.toLowerCase().includes(q));
      if (genre) items = items.filter((w) => w.genre === genre);
      if (hideAcquired) items = items.filter((w) => !w.acquired);
      if (availableOnly) items = items.filter((w) => w.availableListingId);

      if (sort === 'title') items.sort((a, b) => a.title.localeCompare(b.title));
      else if (sort === 'added') items.sort((a, b) => b.addedAt - a.addedAt);
      else {
        // Still-wanted books first, then highest priority, then oldest first
        items.sort((a, b) =>
          Number(a.acquired) - Number(b.acquired) ||
          PRIORITIES[b.priority] - PRIORITIES[a.priority] ||
          a.addedAt - b.addedAt);
      }
      return items;
    }

    /* ---------- Direct exchange and completion ---------- */

    function releaseListings(x) {
      [x.listingId, x.offeredListingId].forEach((id) => {
        const l = findListing(id);
        if (l && l.status === 'reserved') l.status = 'available';
      });
    }

    function requestExchange({ listingId, offeredListingId, date, time, place }) {
      const u = requireUser();
      const target = findListing(listingId);
      const offered = findListing(offeredListingId);
      if (!target) fail('Book not found.');
      if (target.ownerId === u.id) fail('You cannot request your own book.');
      if (target.status !== 'available') fail('This book is no longer available.');
      if (!offered || offered.ownerId !== u.id) fail('Choose one of your own books to offer.');
      if (offered.status !== 'available') fail('The book you offered is already in another swap.');
      if (!date || !time || !clean(place)) fail('Please propose a date, time and meeting place.');
      if (new Date(`${date}T${time}`).getTime() < now()) fail('The meeting time must be in the future.');

      const dup = state.exchanges.some((x) =>
        x.requesterId === u.id && x.listingId === listingId && x.status === 'pending');
      if (dup) fail('You already have a pending request for this book.');

      const x = {
        id: uid('x'),
        listingId, offeredListingId,
        requesterId: u.id, ownerId: target.ownerId,
        meeting: { date, time, place: clean(place) },
        status: 'pending', // pending | accepted | declined | cancelled | completed | problem
        parties: {
          [u.id]: { handedOver: null, received: null },
          [target.ownerId]: { handedOver: null, received: null }
        },
        problem: null,
        createdAt: now(), closedAt: null
      };
      state.exchanges.push(x);
      save();
      return x;
    }

    function participantExchange(id) {
      const u = requireUser();
      const x = findExchange(id);
      if (!x || (x.requesterId !== u.id && x.ownerId !== u.id)) fail('Exchange not found.');
      return { u, x };
    }

    function respondToExchange(id, accept) {
      const { u, x } = participantExchange(id);
      if (x.ownerId !== u.id) fail('Only the book owner can respond to this request.');
      if (x.status !== 'pending') fail('This request has already been answered.');

      if (accept) {
        const target = findListing(x.listingId);
        const offered = findListing(x.offeredListingId);
        if (!target || target.status !== 'available' || !offered || offered.status !== 'available') {
          fail('One of the books is no longer available.');
        }
        target.status = 'reserved';
        offered.status = 'reserved';
        x.status = 'accepted';
      } else {
        x.status = 'declined';
        x.closedAt = now();
      }
      save();
      return x;
    }

    function updateMeeting(id, { date, time, place }) {
      const { x } = participantExchange(id);
      if (!['pending', 'accepted'].includes(x.status)) fail('This swap can no longer be changed.');
      if (!date || !time || !clean(place)) fail('Please enter a date, time and place.');
      x.meeting = { date, time, place: clean(place) };
      save();
      return x;
    }

    function cancelExchange(id) {
      const { x } = participantExchange(id);
      if (!['pending', 'accepted'].includes(x.status)) fail('This swap is already closed.');
      x.status = 'cancelled';
      x.closedAt = now();
      releaseListings(x);
      save();
      return x;
    }

    function checkCompletion(x) {
      const done = Object.values(x.parties).every((p) => p.handedOver && p.received);
      if (done) {
        x.status = 'completed';
        x.closedAt = now();
        [x.listingId, x.offeredListingId].forEach((lid) => {
          const l = findListing(lid);
          if (l) l.status = 'swapped';
        });
      }
    }

    // flag is 'handedOver' or 'received'; clicking again undoes it until the swap completes
    function toggleCompletion(id, flag) {
      if (!['handedOver', 'received'].includes(flag)) fail('Unknown step.');
      const { u, x } = participantExchange(id);
      if (x.status !== 'accepted') fail('Only accepted swaps can be marked.');
      const mine = x.parties[u.id];
      mine[flag] = mine[flag] ? null : now();
      checkCompletion(x);
      save();
      return x;
    }

    function reportProblem(id, reason, details) {
      const { u, x } = participantExchange(id);
      if (!['accepted', 'completed'].includes(x.status)) fail('You can only report a problem on an accepted or completed swap.');
      if (!PROBLEM_REASONS.includes(reason)) fail('Please choose a reason.');
      x.status = 'problem';
      x.problem = { reportedBy: u.id, reason, details: clean(details).slice(0, 500), at: now() };
      x.closedAt = now();
      save();
      return x;
    }

    function getMyExchanges() {
      const u = requireUser();
      return state.exchanges
        .filter((x) => x.requesterId === u.id || x.ownerId === u.id)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((x) => {
          const otherId = x.requesterId === u.id ? x.ownerId : x.requesterId;
          return Object.assign({}, x, {
            role: x.ownerId === u.id ? 'owner' : 'requester',
            target: findListing(x.listingId),
            offered: findListing(x.offeredListingId),
            other: publicProfile(otherId) || { name: 'Deleted user' },
            me: x.parties[u.id],
            them: x.parties[otherId] || { handedOver: null, received: null },
            reviewed: state.reviews.some((r) => r.exchangeId === x.id && r.reviewerId === u.id)
          });
        });
    }

    /* ---------- Feedback and rating ---------- */

    function addReview(exchangeId, rating, comment) {
      const { u, x } = participantExchange(exchangeId);
      if (x.status !== 'completed') fail('You can rate a swap only after it is completed.');
      rating = Number(rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail('Rating must be 1 to 5 stars.');
      if (state.reviews.some((r) => r.exchangeId === x.id && r.reviewerId === u.id)) {
        fail('You have already reviewed this swap.');
      }
      const review = {
        id: uid('r'), exchangeId,
        reviewerId: u.id,
        revieweeId: x.requesterId === u.id ? x.ownerId : x.requesterId,
        rating, comment: clean(comment).slice(0, 500),
        createdAt: now()
      };
      state.reviews.push(review);
      save();
      return review;
    }

    function deleteReview(id) {
      const u = requireUser();
      const r = state.reviews.find((v) => v.id === id);
      if (!r || r.reviewerId !== u.id) fail('Review not found.');
      state.reviews = state.reviews.filter((v) => v.id !== id);
      save();
    }

    function reviewsFor(userId) {
      return state.reviews
        .filter((r) => r.revieweeId === userId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => Object.assign({}, r, { reviewer: (findUser(r.reviewerId) || { name: 'Deleted user' }).name }));
    }

    /* ---------- Messages ---------- */

    const MAX_MESSAGE = 1000;

    function sendMessage(toUserId, text, listingId) {
      const u = requireUser();
      text = clean(text);
      if (!text) fail('Type a message first.');
      if (text.length > MAX_MESSAGE) fail(`Messages can be up to ${MAX_MESSAGE} characters.`);
      if (toUserId === u.id) fail('You cannot message yourself.');
      if (!findUser(toUserId)) fail('This user no longer exists.');
      const listing = listingId ? findListing(listingId) : null;

      const msg = {
        id: uid('m'), fromId: u.id, toId: toUserId, text,
        listingId: listing ? listing.id : null,
        listingTitle: listing ? listing.title : null,
        read: false, at: now()
      };
      state.messages.push(msg);
      save();
      return msg;
    }

    // One row per person you've talked to, newest first
    function getConversations() {
      const u = requireUser();
      const byOther = new Map();
      state.messages.forEach((m) => {
        if (m.fromId !== u.id && m.toId !== u.id) return;
        const otherId = m.fromId === u.id ? m.toId : m.fromId;
        const c = byOther.get(otherId) || { otherId, last: null, unread: 0 };
        if (!c.last || m.at >= c.last.at) c.last = m;
        if (m.toId === u.id && !m.read) c.unread++;
        byOther.set(otherId, c);
      });
      return [...byOther.values()]
        .map((c) => Object.assign(c, { other: publicProfile(c.otherId) || { id: c.otherId, name: 'Deleted user' } }))
        .sort((a, b) => b.last.at - a.last.at);
    }

    // All messages with one person, oldest first. Opening it marks theirs as read.
    function openThread(otherId) {
      const u = requireUser();
      const thread = state.messages
        .filter((m) => (m.fromId === u.id && m.toId === otherId) || (m.fromId === otherId && m.toId === u.id))
        .sort((a, b) => a.at - b.at);
      let changed = false;
      thread.forEach((m) => {
        if (m.toId === u.id && !m.read) { m.read = true; changed = true; }
      });
      if (changed) save();
      return thread.map((m) => Object.assign({}, m, { mine: m.fromId === u.id }));
    }

    function unreadMessageCount() {
      const u = currentUser();
      if (!u) return 0;
      return state.messages.filter((m) => m.toId === u.id && !m.read).length;
    }

    /* ---------- Demo data for presenting ---------- */

    function seedDemo() {
      // Creating demo users must not change who is signed in on this tab
      const prev = state.session;
      const prevTab = tabStorage.getItem(TAB_SESSION_KEY);
      const prevRemembered = storage.getItem(REMEMBERED_KEY);
      const demo = [
        { name: 'Layla Hassan', email: 'layla@example.com', location: 'Manama', books: [
          ['The Alchemist', 'Paulo Coelho', 'Fiction', 'Good'],
          ['Sapiens', 'Yuval Noah Harari', 'History', 'New'],
          ['Atomic Habits', 'James Clear', 'Self-help', 'Used']] },
        { name: 'Omar Saleh', email: 'omar@example.com', location: 'Riffa', books: [
          ['The Hobbit', 'J.R.R. Tolkien', 'Fantasy', 'Good'],
          ['A Brief History of Time', 'Stephen Hawking', 'Science', 'Used'],
          ['Clean Code', 'Robert C. Martin', 'Non-fiction', 'Good']] }
      ];
      let added = 0;
      demo.forEach((d) => {
        if (state.users.some((u) => u.email === d.email)) return;
        register({ name: d.name, email: d.email, password: 'password123' });
        updateProfile({ location: d.location });
        d.books.forEach(([title, author, genre, condition]) => createListing({ title, author, genre, condition }));
        added++;
      });
      state.session = prev;
      if (prevTab) tabStorage.setItem(TAB_SESSION_KEY, prevTab); else tabStorage.removeItem(TAB_SESSION_KEY);
      if (prevRemembered) storage.setItem(REMEMBERED_KEY, prevRemembered); else storage.removeItem(REMEMBERED_KEY);
      save();
      return added;
    }

    return {
      // accounts
      register, signIn, signOut, currentUser: () => {
        const u = currentUser();
        // Email and password date are only returned to the signed-in owner
        return u ? Object.assign(publicProfile(u.id), {
          email: u.email, passwordChangedAt: u.passwordChangedAt || u.createdAt
        }) : null;
      },
      updateProfile, setPhoto, changePassword, deleteAccount, publicProfile,
      // listings
      createListing, deleteListing, browseListings, myListings,
      // wishlist
      addToWishlist, addListingToWishlist, removeFromWishlist, setWishPriority, toggleWishAcquired, getWishlist,
      // exchanges
      requestExchange, respondToExchange, updateMeeting, cancelExchange, toggleCompletion, reportProblem, getMyExchanges,
      // reviews
      addReview, deleteReview, reviewsFor, averageRating,
      // misc
      // messages
      sendMessage, getConversations, openThread, unreadMessageCount,
      seedDemo, refresh,
      reset: () => { state = emptyState(); save(); }
    };
  }

  const api = { createStore, memoryStorage, AppError, GENRES, CONDITIONS, PRIORITIES, PROBLEM_REASONS, STORAGE_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SwapCycle = api;
})(typeof window !== 'undefined' ? window : globalThis);
