import { categories, menu } from "./menu.js";

const STORAGE_KEY = "saldens-orders-v1";
const STATUS = {
  new: { label: "Новый", next: "cooking", action: "Начать готовить" },
  cooking: { label: "Готовится", next: "ready", action: "Отметить готовым" },
  ready: { label: "Готов", next: "served", action: "Отметить поданным" },
  served: { label: "Подан", next: null, action: null }
};

const state = {
  view: "menu",
  category: "Все",
  query: "",
  cart: {},
  orders: readOrders()
};

const elements = Object.fromEntries(
  [
    "brandButton", "menuTab", "ordersTab", "ordersBadge", "cartButton", "cartBadge",
    "mobileMenuTab", "mobileOrdersTab", "mobileOrdersBadge", "mobileCartButton",
    "mobileCartBadge", "menuView", "ordersView", "searchInput", "categories",
    "categoryTitle", "itemsCount", "menuGrid", "menuEmpty", "orderList", "ordersEmpty",
    "clearServedButton", "emptyMenuButton", "backdrop", "cartDrawer", "closeCartButton",
    "cartLines", "cartEmpty", "cartTotal", "checkoutButton", "checkoutModal",
    "closeCheckoutButton", "checkoutForm", "tableInput", "guestInput", "notesInput",
    "checkoutItems", "checkoutTotal", "toast"
  ].map((id) => [id, document.getElementById(id)])
);

function readOrders() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveOrders() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.orders));
}

function formatPrice(value) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cartLines() {
  return menu
    .filter((item) => state.cart[item.id])
    .map((item) => ({ ...item, quantity: state.cart[item.id] }));
}

function cartSummary() {
  return cartLines().reduce(
    (result, item) => {
      result.count += item.quantity;
      result.total += item.price * item.quantity;
      return result;
    },
    { count: 0, total: 0 }
  );
}

function setView(view) {
  state.view = view;
  const menuActive = view === "menu";
  elements.menuView.classList.toggle("is-hidden", !menuActive);
  elements.ordersView.classList.toggle("is-hidden", menuActive);
  elements.menuTab.classList.toggle("is-active", menuActive);
  elements.ordersTab.classList.toggle("is-active", !menuActive);
  elements.mobileMenuTab.classList.toggle("is-active", menuActive);
  elements.mobileOrdersTab.classList.toggle("is-active", !menuActive);
  if (!menuActive) renderOrders();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCategories() {
  elements.categories.innerHTML = ["Все", ...categories]
    .map(
      (category) =>
        `<button type="button" class="${category === state.category ? "is-active" : ""}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
    )
    .join("");
}

function visibleMenu() {
  const query = state.query.trim().toLocaleLowerCase("ru");
  return menu.filter((item) => {
    const categoryMatches = state.category === "Все" || item.category === state.category;
    const queryMatches =
      !query ||
      item.name.toLocaleLowerCase("ru").includes(query) ||
      item.description.toLocaleLowerCase("ru").includes(query);
    return categoryMatches && queryMatches;
  });
}

function renderMenu() {
  const items = visibleMenu();
  elements.categoryTitle.textContent = state.category === "Все" ? "Всё меню" : state.category;
  elements.itemsCount.textContent = `${items.length} ${plural(items.length, "позиция", "позиции", "позиций")}`;
  elements.menuEmpty.classList.toggle("is-hidden", items.length > 0);
  elements.menuGrid.innerHTML = items
    .map((item) => {
      const quantity = state.cart[item.id] || 0;
      const image = item.image
        ? `<img src="./assets/saldens-${item.image}.jpg" alt="" loading="lazy" />`
        : `<span class="dish-letter" aria-hidden="true">${escapeHtml(item.name.charAt(0))}</span>`;
      return `
        <article class="menu-card">
          <div class="dish-visual ${item.image ? "has-image" : ""}">
            ${image}
            ${item.spicy ? '<span class="spicy" title="Острое">острое</span>' : ""}
          </div>
          <div class="dish-content">
            <div>
              <span class="dish-category">${escapeHtml(item.category)}</span>
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(item.description)}</p>
            </div>
            <div class="dish-footer">
              <strong>${formatPrice(item.price)}</strong>
              ${
                quantity
                  ? `<div class="quantity" aria-label="Количество ${escapeHtml(item.name)}">
                      <button type="button" data-change="-1" data-item="${item.id}" aria-label="Уменьшить">−</button>
                      <b>${quantity}</b>
                      <button type="button" data-change="1" data-item="${item.id}" aria-label="Увеличить">+</button>
                    </div>`
                  : `<button class="add-button" type="button" data-add="${item.id}" aria-label="Добавить ${escapeHtml(item.name)}">+</button>`
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");
  renderCartState();
}

function renderCartState() {
  const lines = cartLines();
  const summary = cartSummary();
  elements.cartBadge.textContent = summary.count;
  elements.mobileCartBadge.textContent = summary.count;
  elements.cartButton.disabled = summary.count === 0;
  elements.cartEmpty.classList.toggle("is-hidden", lines.length > 0);
  elements.checkoutButton.disabled = lines.length === 0;
  elements.cartTotal.textContent = formatPrice(summary.total);
  elements.checkoutItems.textContent = `${summary.count} ${plural(summary.count, "позиция", "позиции", "позиций")}`;
  elements.checkoutTotal.textContent = formatPrice(summary.total);
  elements.cartLines.innerHTML = lines
    .map(
      (item) => `
        <article class="cart-line">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${formatPrice(item.price)} × ${item.quantity}</span>
          </div>
          <div class="quantity">
            <button type="button" data-change="-1" data-item="${item.id}" aria-label="Уменьшить">−</button>
            <b>${item.quantity}</b>
            <button type="button" data-change="1" data-item="${item.id}" aria-label="Увеличить">+</button>
          </div>
        </article>
      `
    )
    .join("");
}

function changeQuantity(itemId, change) {
  const next = Math.max(0, (state.cart[itemId] || 0) + change);
  if (next) state.cart[itemId] = next;
  else delete state.cart[itemId];
  renderMenu();
}

function orderTotal(order) {
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function renderOrders() {
  const activeCount = state.orders.filter((order) => order.status !== "served").length;
  [elements.ordersBadge, elements.mobileOrdersBadge].forEach((badge) => {
    badge.textContent = activeCount;
    badge.classList.toggle("is-hidden", activeCount === 0);
  });
  elements.ordersEmpty.classList.toggle("is-hidden", state.orders.length > 0);
  elements.clearServedButton.disabled = !state.orders.some((order) => order.status === "served");
  elements.orderList.innerHTML = state.orders
    .map((order) => {
      const status = STATUS[order.status] || STATUS.new;
      const items = order.items
        .map(
          (item) =>
            `<li><span>${item.quantity} × ${escapeHtml(item.name)}</span><b>${formatPrice(item.price * item.quantity)}</b></li>`
        )
        .join("");
      return `
        <article class="order-card status-${order.status}">
          <header>
            <div>
              <span class="status">${status.label}</span>
              <h2>Стол ${escapeHtml(order.table)}</h2>
              <p>${escapeHtml(order.guest || "Без имени")} · ${formatTime(order.createdAt)}</p>
            </div>
            <strong>${formatPrice(orderTotal(order))}</strong>
          </header>
          <ul>${items}</ul>
          ${order.notes ? `<p class="order-note"><b>Комментарий:</b> ${escapeHtml(order.notes)}</p>` : ""}
          <footer>
            <span>${order.items.reduce((sum, item) => sum + item.quantity, 0)} поз.</span>
            ${
              status.next
                ? `<button class="primary-button" type="button" data-advance="${order.id}">${status.action}</button>`
                : `<button class="secondary-button" type="button" data-delete="${order.id}">Удалить</button>`
            }
          </footer>
        </article>
      `;
    })
    .join("");
}

function submitOrder(event) {
  event.preventDefault();
  const table = elements.tableInput.value.trim();
  const lines = cartLines();
  if (!table || !lines.length) return;
  const order = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    table,
    guest: elements.guestInput.value.trim(),
    notes: elements.notesInput.value.trim(),
    status: "new",
    createdAt: Date.now(),
    items: lines.map(({ id, name, price, quantity }) => ({ id, name, price, quantity }))
  };
  state.orders.unshift(order);
  saveOrders();
  state.cart = {};
  elements.checkoutForm.reset();
  closeOverlays();
  renderMenu();
  renderOrders();
  setView("orders");
  showToast(`Заказ стола ${table} сохранён`);
}

function advanceOrder(id) {
  const order = state.orders.find((item) => item.id === id);
  if (!order) return;
  const next = STATUS[order.status]?.next;
  if (!next) return;
  order.status = next;
  saveOrders();
  renderOrders();
}

function deleteOrder(id) {
  state.orders = state.orders.filter((order) => order.id !== id);
  saveOrders();
  renderOrders();
  showToast("Заказ удалён");
}

function clearServed() {
  const count = state.orders.filter((order) => order.status === "served").length;
  if (!count) return;
  state.orders = state.orders.filter((order) => order.status !== "served");
  saveOrders();
  renderOrders();
  showToast(`Убрано поданных заказов: ${count}`);
}

function openCart() {
  renderCartState();
  elements.backdrop.classList.remove("is-hidden");
  elements.cartDrawer.classList.add("is-open");
  elements.cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  elements.closeCartButton.focus();
}

function openCheckout() {
  if (!cartLines().length) return;
  elements.cartDrawer.classList.remove("is-open");
  elements.cartDrawer.setAttribute("aria-hidden", "true");
  elements.checkoutModal.classList.remove("is-hidden");
  elements.tableInput.focus();
}

function closeOverlays() {
  elements.backdrop.classList.add("is-hidden");
  elements.cartDrawer.classList.remove("is-open");
  elements.cartDrawer.setAttribute("aria-hidden", "true");
  elements.checkoutModal.classList.add("is-hidden");
  document.body.classList.remove("no-scroll");
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("is-hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.add("is-hidden"), 2800);
}

function plural(number, one, few, many) {
  const lastTwo = number % 100;
  const last = number % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function bindEvents() {
  elements.brandButton.addEventListener("click", () => setView("menu"));
  elements.menuTab.addEventListener("click", () => setView("menu"));
  elements.ordersTab.addEventListener("click", () => setView("orders"));
  elements.mobileMenuTab.addEventListener("click", () => setView("menu"));
  elements.mobileOrdersTab.addEventListener("click", () => setView("orders"));
  elements.emptyMenuButton.addEventListener("click", () => setView("menu"));
  elements.cartButton.addEventListener("click", openCart);
  elements.mobileCartButton.addEventListener("click", openCart);
  elements.closeCartButton.addEventListener("click", closeOverlays);
  elements.closeCheckoutButton.addEventListener("click", closeOverlays);
  elements.backdrop.addEventListener("click", closeOverlays);
  elements.checkoutButton.addEventListener("click", openCheckout);
  elements.checkoutForm.addEventListener("submit", submitOrder);
  elements.clearServedButton.addEventListener("click", clearServed);

  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderMenu();
  });

  elements.categories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    renderCategories();
    renderMenu();
  });

  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    const change = event.target.closest("[data-change]");
    const advance = event.target.closest("[data-advance]");
    const remove = event.target.closest("[data-delete]");
    if (add) changeQuantity(add.dataset.add, 1);
    else if (change) changeQuantity(change.dataset.item, Number(change.dataset.change));
    else if (advance) advanceOrder(advance.dataset.advance);
    else if (remove) deleteOrder(remove.dataset.delete);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOverlays();
  });
}

renderCategories();
renderMenu();
renderOrders();
bindEvents();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}
