(function () {
  var $ = function (s) { return document.querySelector(s); };
  var fmt = function (n) { return Number(n).toLocaleString('vi-VN') + 'đ'; };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  // 1) Giao diện sáng / tối (lưu lựa chọn trong trình duyệt)
  var root = document.documentElement, tbtn = $('.theme-toggle');
  function paintTheme() {
    var dark = root.getAttribute('data-theme') === 'dark';
    if (tbtn) { tbtn.textContent = dark ? '☀️' : '🌙'; tbtn.setAttribute('aria-pressed', dark ? 'true' : 'false'); }
  }
  if (tbtn) tbtn.addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') !== 'dark';
    if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
    try { localStorage.setItem('campuskit_theme', dark ? 'dark' : 'light'); } catch (e) {}
    paintTheme();
  });
  paintTheme();

  // 2) Đếm ngược flash sale (tự ẩn khi hết hạn)
  var flash = $('#flash');
  if (flash) {
    var end = new Date(flash.dataset.end).getTime(), timer = $('#flash-timer'), iv = null;
    var tick = function () {
      var left = end - Date.now();
      if (isNaN(end) || left <= 0) { flash.hidden = true; if (iv) clearInterval(iv); return; }
      var d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
      timer.textContent = (d > 0 ? d + ' ngày ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
      flash.hidden = false;
    };
    tick();
    if (!flash.hidden) iv = setInterval(tick, 1000);
  }

  // 3) Gợi ý theo năm học / ngành
  var pkYear = $('#pk-year'), pkMajor = $('#pk-major'), pkOut = $('#pk-result'), pkPool = $('#pk-pool'), pkHint = $('#pk-hint');
  if (pkYear && pkMajor && pkOut && pkPool) {
    var pool = Array.prototype.slice.call(pkPool.querySelectorAll('.card'));
    var split = function (s) { return s ? s.split(',') : []; };
    var suggest = function () {
      var y = pkYear.value, m = pkMajor.value;
      pkOut.innerHTML = '';
      if (!y && !m) { pkHint.textContent = 'Chọn năm học và ngành để xem đồ nên mua.'; return; }
      var scored = [];
      pool.forEach(function (card, idx) {
        var ys = split(card.dataset.years), ms = split(card.dataset.majors), score = 0;
        if (y && ys.length) { if (ys.indexOf(y) === -1) return; score++; }
        if (m && ms.length) { if (ms.indexOf(m) === -1) return; score++; }
        scored.push({ card: card, score: score, idx: idx });
      });
      scored.sort(function (a, b) { return b.score - a.score || a.idx - b.idx; });
      scored.slice(0, 6).forEach(function (x) { pkOut.appendChild(x.card.cloneNode(true)); });
      pkHint.textContent = scored.length ? 'Gợi ý cho bạn (' + Math.min(6, scored.length) + ' sản phẩm):' : 'Chưa có gợi ý phù hợp.';
      document.dispatchEvent(new Event('campuskit:render'));
    };
    pkYear.addEventListener('change', suggest);
    pkMajor.addEventListener('change', suggest);
  }

  // 4) Trang "Đơn hàng của tôi": tra cứu + trạng thái chạy theo thời gian (mô phỏng)
  var olist = $('#order-list');
  if (olist) {
    var STEPS = ['Đã tiếp nhận', 'Đang chuẩn bị', 'Sẵn sàng nhận', 'Hoàn thành'];
    var AT = [0, 1, 3, 6];   // phút kể từ lúc đặt
    var input = $('#order-code'), emptyBox = $('#order-empty'), clearBtn = $('#order-clear');
    var readOrders = function () {
      try { var v = JSON.parse(localStorage.getItem('campuskit_orders')); return Array.isArray(v) ? v : []; } catch (e) { return []; }
    };
    var orderHtml = function (o) {
      var mins = (Date.now() - Number(o.time)) / 60000, now = 0, last = STEPS.length - 1;
      for (var i = 0; i < AT.length; i++) if (mins >= AT[i]) now = i;
      var steps = STEPS.map(function (s, i) {
        var cls = (now === last || i < now) ? 'done' : (i === now ? 'now' : '');
        return '<li class="' + cls + '">' + s + '</li>';
      }).join('');
      var items = (Array.isArray(o.items) ? o.items : []).map(function (it) {
        return '<li>' + esc(it.name) + ' × ' + esc(it.qty) + '</li>';
      }).join('');
      return '<article class="order"><div class="order-head"><strong>' + esc(o.code) + '</strong>' +
        '<span class="muted">' + new Date(Number(o.time)).toLocaleString('vi-VN') + '</span></div>' +
        '<ol class="steps">' + steps + '</ol><ul>' + items + '</ul>' +
        '<p>Thanh toán: ' + esc(o.pay) + '<br>Tổng cộng: <strong>' + fmt(o.total) + '</strong></p></article>';
    };
    var renderOrders = function () {
      var q = input.value.trim().toUpperCase(), all = readOrders();
      var list = q ? all.filter(function (o) { return String(o.code).toUpperCase().indexOf(q) !== -1; }) : all;
      olist.innerHTML = list.map(orderHtml).join('');
      emptyBox.hidden = list.length > 0;
      emptyBox.textContent = !all.length ? 'Bạn chưa có đơn hàng nào trên thiết bị này.' : 'Không tìm thấy đơn "' + q + '" trên thiết bị này.';
    };
    input.addEventListener('input', renderOrders);
    if (clearBtn) clearBtn.addEventListener('click', function () {
      if (!readOrders().length) return;
      if (window.confirm('Xoá toàn bộ lịch sử đơn hàng trên thiết bị này?')) {
        try { localStorage.removeItem('campuskit_orders'); } catch (e) {}
        renderOrders();
      }
    });
    renderOrders();
    setInterval(renderOrders, 15000);
  }
})();
