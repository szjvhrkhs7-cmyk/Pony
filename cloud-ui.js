(() => {
  'use strict';

  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = './cloud.css';
  document.head.append(stylesheet);

  const actions = document.querySelector('.topbar-actions');
  if (actions && !document.getElementById('cloudButton')) {
    const button = document.createElement('button');
    button.className = 'button button-ghost cloud-button';
    button.id = 'cloudButton';
    button.type = 'button';
    button.dataset.mode = 'local';
    button.innerHTML = '<span class="cloud-dot" aria-hidden="true"></span><span id="cloudStatusText">Локально</span>';
    actions.insertBefore(button, actions.firstChild);
  }

  if (!document.getElementById('cloudModal')) {
    const backdrop = document.createElement('div');
    backdrop.className = 'cloud-backdrop is-hidden';
    backdrop.id = 'cloudBackdrop';

    const modal = document.createElement('section');
    modal.className = 'cloud-modal is-hidden';
    modal.id = 'cloudModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'cloudTitle');
    modal.innerHTML = `
      <button class="cloud-close" id="cloudClose" type="button" aria-label="Закрыть">×</button>
      <p class="eyebrow">Синхронизация</p>
      <h2 id="cloudTitle">Облако и устройство</h2>
      <p>Записи всегда сначала сохраняются на этом устройстве. Если сеть доступна и выполнен вход, актуальная копия автоматически отправляется в облако.</p>

      <div class="cloud-local-note">
        <span aria-hidden="true">◈</span>
        <div><strong>Офлайн-режим включён всегда</strong>Без интернета можно продолжать редактировать игры и игровые дни. После восстановления сети изменения синхронизируются автоматически.</div>
      </div>

      <div class="cloud-form">
        <label><span>E-mail</span><input id="cloudEmail" type="email" autocomplete="email" placeholder="name@example.com"></label>
        <label><span>Пароль</span><input id="cloudPassword" type="password" autocomplete="current-password" minlength="6" placeholder="Не короче 6 символов"></label>
        <div class="cloud-actions">
          <button class="button button-primary" id="cloudLogin" type="button">Войти</button>
          <button class="button button-ghost" id="cloudRegister" type="button">Создать аккаунт</button>
          <button class="button button-ghost is-hidden" id="syncNow" type="button">Синхронизировать</button>
        </div>
      </div>

      <div class="cloud-account">
        <div><strong>Локальная копия</strong><span>Не удаляется при выходе из облака</span></div>
        <button class="button button-danger is-hidden" id="cloudLogout" type="button">Выйти из облака</button>
      </div>

      <p class="cloud-details" id="syncDetails">Сейчас данные хранятся только на этом устройстве. Войдите или создайте аккаунт, чтобы включить облачную копию.</p>
    `;

    document.body.append(backdrop, modal);
  }
})();
