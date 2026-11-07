(function () {
  var KEY = 'campuskit_cart', WISH = 'campuskit_wish', ORDERS = 'campuskit_orders';
  var COUPONS = { CAMPUS10: 10, SV15: 15 };   // >>> THAY mã giảm giá của nhóm
  var FREE_SHIP = 200000, SHIP = 15000;
  var coupon = { code: '', pct: 0 };
  var done = false;
  var applyList = null;   // gán ở phần "Tìm kiếm + lọc + sắp xếp"
  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) { return Number(n).toLocaleString('vi-VN') + 'đ'; };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };

  function read(key) {
    try { var v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function load() { return read(KEY); }
  function save(c) { write(KEY, c); updateCount(); }
  function updateCount() {
    var n = load().reduce(function (s, i) { return s + i.qty; }, 0);
    document.querySelectorAll('.cart-count').forEach(function (e) { e.textContent = n; });
  }
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1600);
  }

  // Định dạng giá
  document.querySelectorAll('.vnd').forEach(function (e) { e.textContent = fmt(e.textContent); });

  // Thêm vào giỏ / Mua ngay
  function addItem(b) {
    var cart = load(), id = b.dataset.id;
    var item = cart.find(function (i) { return i.id === id; });
    if (item) item.qty++;
    else cart.push({ id: id, name: b.dataset.name, price: Number(b.dataset.price), image: b.dataset.image, qty: 1 });
    save(cart);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.add-to-cart, .buy-now');
    if (!b) return;
    addItem(b);
    if (b.classList.contains('buy-now')) {
      var link = $('.cart-link');
      if (link) window.location.href = link.href;
      return;
    }
    toast('Đã thêm "' + b.dataset.name + '" vào giỏ');
  });

  // Yêu thích (lưu trong trình duyệt)
  function syncWish() {
    var w = read(WISH);
    document.querySelectorAll('.wish').forEach(function (b) {
      var on = w.indexOf(b.dataset.id) !== -1;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var h = b.querySelector('.heart'); if (h) h.textContent = on ? '♥' : '♡';
      var l = b.querySelector('.wish-label'); if (l) l.textContent = on ? 'Đã lưu' : 'Lưu vào yêu thích';
    });
    var c = $('#wish-count'); if (c) c.textContent = w.length;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.wish');
    if (!b) return;
    var w = read(WISH), i = w.indexOf(b.dataset.id);
    if (i === -1) { w.push(b.dataset.id); toast('Đã lưu vào yêu thích'); }
    else { w.splice(i, 1); toast('Đã bỏ khỏi yêu thích'); }
    write(WISH, w);
    syncWish();
    if (applyList) applyList();
  });
  document.addEventListener('campuskit:render', syncWish);   // khi trang tự thêm thẻ sản phẩm mới

  // Tìm kiếm + lọc + sắp xếp + chỉ xem đã lưu
  var search = $('#search'), cat = $('#category'), sortSel = $('#sort'), wishBtn = $('#wish-filter'), grid = $('#product-grid');
  if (search && cat && grid) {
    var original = Array.prototype.slice.call(grid.querySelectorAll('.card'));
    var emptyBox = $('#no-result'), emptyDefault = emptyBox.textContent, wishOnly = false;
    applyList = function () {
      var q = search.value.trim().toLowerCase(), c = cat.value, w = read(WISH), shown = 0;
      original.forEach(function (card) {
        var ok = card.dataset.name.indexOf(q) !== -1 &&
                 (!c || card.dataset.category === c) &&
                 (!wishOnly || w.indexOf(card.dataset.id) !== -1);
        card.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      var order = original.slice(), mode = sortSel ? sortSel.value : '';
      if (mode === 'asc') order.sort(function (a, b) { return a.dataset.price - b.dataset.price; });
      if (mode === 'desc') order.sort(function (a, b) { return b.dataset.price - a.dataset.price; });
      if (mode === 'name') order.sort(function (a, b) { return a.dataset.name.localeCompare(b.dataset.name, 'vi'); });
      order.forEach(function (card) { grid.appendChild(card); });
      emptyBox.hidden = shown > 0;
      emptyBox.textContent = (wishOnly && !w.length) ? 'Bạn chưa lưu sản phẩm nào. Bấm ♡ ở sản phẩm để lưu.' : emptyDefault;
    };
    search.addEventListener('input', applyList);
    cat.addEventListener('change', applyList);
    if (sortSel) sortSel.addEventListener('change', applyList);
    if (wishBtn) wishBtn.addEventListener('click', function () {
      wishOnly = !wishOnly;
      wishBtn.setAttribute('aria-pressed', wishOnly ? 'true' : 'false');
      applyList();
    });
  }

  // Trang giỏ hàng
  var itemsBox = $('#cart-items');
  function totals(cart) {
    var sub = cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var disc = Math.round(sub * coupon.pct / 100);
    var ship = (sub === 0 || sub - disc >= FREE_SHIP) ? 0 : SHIP;
    return { sub: sub, disc: disc, ship: ship, total: sub - disc + ship };
  }
  function render() {
    if (!itemsBox || done) return;
    var cart = load();
    $('#cart-empty').hidden = cart.length > 0;
    $('#cart-wrap').hidden = cart.length === 0;
    itemsBox.innerHTML = cart.map(function (i) {
      return '<div class="row"><img src="' + i.image + '" alt="">' +
        '<div class="info"><strong>' + esc(i.name) + '</strong><span class="muted">' + fmt(i.price) + '</span></div>' +
        '<div class="qty"><button type="button" data-act="dec" data-id="' + i.id + '">−</button><span>' + i.qty +
        '</span><button type="button" data-act="inc" data-id="' + i.id + '">+</button></div>' +
        '<button type="button" class="del" data-act="del" data-id="' + i.id + '" aria-label="Xoá">✕</button></div>';
    }).join('');
    var t = totals(cart);
    $('#t-sub').textContent = fmt(t.sub);
    $('#t-disc').textContent = '-' + fmt(t.disc);
    $('#t-ship').textContent = t.ship ? fmt(t.ship) : 'Miễn phí';
    $('#t-total').textContent = fmt(t.total);

    // Thanh tiến độ freeship
    var net = t.sub - t.disc, pct = Math.min(100, Math.round(net * 100 / FREE_SHIP));
    var bar = $('#ship-bar'), msg = $('#ship-msg'), box = $('#ship-box');
    if (bar) bar.style.width = pct + '%';
    if (box) box.setAttribute('aria-valuenow', pct);
    if (msg) msg.textContent = net >= FREE_SHIP
      ? '🎉 Bạn được miễn phí giao hàng!'
      : 'Mua thêm ' + fmt(FREE_SHIP - net) + ' để được miễn phí giao hàng';
  }
  if (itemsBox) {
    itemsBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var cart = load(), i = cart.find(function (x) { return x.id === b.dataset.id; });
      if (!i) return;
      if (b.dataset.act === 'inc') i.qty++;
      if (b.dataset.act === 'dec') i.qty = Math.max(1, i.qty - 1);
      if (b.dataset.act === 'del') cart = cart.filter(function (x) { return x !== i; });
      save(cart); render();
    });
    $('#apply-coupon').addEventListener('click', function () {
      var code = $('#coupon').value.trim().toUpperCase(), msg = $('#coupon-msg');
      if (COUPONS[code]) { coupon = { code: code, pct: COUPONS[code] }; msg.textContent = 'Đã áp dụng ' + code + ' (-' + coupon.pct + '%)'; }
      else { coupon = { code: '', pct: 0 }; msg.textContent = 'Mã không hợp lệ.'; }
      render();
    });
    $('#checkout-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var cart = load();
      if (!cart.length) return;
      var f = e.target, t = totals(cart);
      var pay = f.querySelector('input[name=pay]:checked').value;
      var code = 'CK' + Math.floor(100000 + Math.random() * 900000);

      // Lưu đơn (chỉ trong trình duyệt) để tra cứu ở trang "Đơn hàng của tôi". Không lưu họ tên/SĐT/địa chỉ.
      var orders = read(ORDERS);
      orders.unshift({
        code: code, time: Date.now(), pay: pay, total: t.total,
        items: cart.map(function (i) { return { name: i.name, qty: i.qty, price: i.price }; })
      });
      write(ORDERS, orders.slice(0, 20));

      var ol = document.querySelector('.orders-link'), ordersUrl = ol ? ol.href : '#';
      $('#order-success').innerHTML = '<h2>🎉 Đặt hàng thành công (mô phỏng)</h2>' +
        '<p>Mã đơn: <strong>' + code + '</strong></p><p>Thanh toán: ' + esc(pay) + '</p>' +
        '<ul>' + cart.map(function (i) { return '<li>' + esc(i.name) + ' × ' + i.qty + '</li>'; }).join('') + '</ul>' +
        '<p>Tổng cộng: <strong>' + fmt(t.total) + '</strong></p>' +
        '<p class="muted">Không có giao dịch thật nào được thực hiện. Đơn chỉ lưu trong trình duyệt của bạn để theo dõi.</p>' +
        '<a class="btn alt" href="' + ordersUrl + '">Theo dõi đơn</a> ' +
        '<a class="btn" href="' + document.querySelector('.brand').href + '">Về trang chủ</a>';
      done = true;
      $('#cart-wrap').hidden = true; $('#cart-empty').hidden = true; $('#order-success').hidden = false;
      save([]); window.scrollTo(0, 0);
    });
  }
  updateCount(); syncWish(); render();
})();
