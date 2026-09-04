<a id="readme-top"></a>

<p align="center">
  <img src="public/icon/128.png" width="96" height="96" alt="TF2 Trade Suite Tools" />
</p>

<h1 align="center">TF2 Trade Suite Tools</h1>

<p align="center">
  A modular, switch-everything-on-or-off browser extension for trading in Team Fortress 2.<br/>
  Модульное расширение для трейдинга в Team Fortress 2 — каждая функция включается отдельно.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version 1.0.0" />
  <img src="https://img.shields.io/badge/Chrome%20%2F%20Edge%20%2F%20Brave-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome MV3" />
  <img src="https://img.shields.io/badge/Firefox-MV2-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white" alt="Firefox MV2" />
  <img src="https://img.shields.io/badge/built%20with-WXT%20%2B%20Vue%203-54BC4A?style=flat-square" alt="Built with WXT + Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript strict" />
</p>

<p align="center">
  <a href="https://steamcommunity.com/profiles/76561198038152985/">
    <img src="https://img.shields.io/badge/Steam-Warrvin-171a21?style=flat-square&logo=steam&logoColor=white" alt="Steam profile: Warrvin" />
  </a>
</p>

<p align="center">
  <img src="docs/screenshots/hero.png" width="760" alt="Wallet summary, quick item add and per-side totals in the trade offer window" />
</p>

<p align="center">
  <a href="#english"><b>🇬🇧 English</b></a> •
  <a href="#russian"><b>🇷🇺 Русский</b></a>
</p>

<br/>

<a id="english"></a>

## 🇬🇧 English

### 📖 About

**TF2 Trade Suite Tools** is a cross-browser extension (Chrome, Firefox, Edge, Brave, Opera) that adds a set of
quality-of-life tools on top of the sites TF2 traders actually use every day: the Steam trade offer window, your
Steam inventory, the Steam Community Market, backpack.tf, scrap.tf, and stntrading.eu.

It isn't one big monolithic script. It's **22 independent modules**, each with its own on/off switch, grouped by
the site they run on. Turn on only what you need — a currency summary in the trade window, item-attribute icons in
your inventory, a price-check button on backpack.tf — and leave the rest off.

### ✨ Features

22 modules across 8 sites. Click a group below to expand it.

<details>
<summary><b>🪟 Trade offer window</b> — <code>steamcommunity.com/tradeoffer/*</code></summary>

| Feature | What it does |
|---|---|
| **Wallet currency summary** | Shows how many keys, refined, reclaimed and scrap you and your trade partner have in your *entire* inventory, not just what's in the offer — updates on a button click. |
| **Quick item add** | A panel inside the trade window: Add, Keys, Metal and Recent buttons, plus a one-click way to clear your side or your partner's. <br/>⚠️ *"Recent" adds items by their position on the page — always double-check the final offer before sending.* |
| **Per-side offer totals** | Under each side's avatar: how many keys and how much metal are actually in the offer right now, live as items are dragged in. Other items can show as a count or be priced via PriceDB.io. |
| **Auto-fill from a backpack.tf link** | Opens a trade from a backpack.tf link? It adds the right item and currency automatically — no clicks needed. <br/>⚠️ *Exact auto-pick only works for sell listings; for buy listings it matches by name and asks you to pick manually if several items qualify.* |
| **"Add listing price" button** | A standalone button that adds the currency from a backpack.tf link on click — independent of the auto-fill above. |
| **Item icons & borders in the offer** | Highlights Unusual effects, the Strange border, a dashed outline for non-craftables, and spell/strange part/killstreak icons right on the item tiles. |

</details>

<details>
<summary><b>📋 Offers list, history & profile</b> — <code>/tradeoffers</code>, <code>/tradehistory</code></summary>

| Feature | What it does |
|---|---|
| **Instant Accept/Decline** | Accept and Decline buttons right in the incoming offers list — no need to open each one. |
| **Decline all offers at once** | One button above the list declines every active incoming offer (with confirmation). |
| **Group identical items** | Identical items collapse into one tile with a ×N badge instead of a long repeated list. |
| **Currency total per offer** | Shows the currency total (or item count, if there's no currency) for each side, right in the list and history. |

</details>

<details>
<summary><b>🎒 Steam inventory</b> — <code>/profiles|id/*/inventory</code></summary>

| Feature | What it does |
|---|---|
| **Item attributes in your inventory** | Same icon engine as the offer window: Unusual, Strange, non-craftable, spell/strange part/killstreak — right on your inventory tiles. |
| **Live currency counter** | Keys/ref/rec/scrap count and total value built into your inventory page — a rough estimate as you scroll, an exact count one button away. |
| **Check price on PriceDB.io** | A button in the item panel opens its PriceDB.io page (or a search page) so you can double-check the price matches the right item/effect. <br/>⚠️ *Lookup is by item name — doesn't account for specific strange parts, spells, or sheen/killstreaker variations.* |

</details>

<details>
<summary><b>🏛️ Steam Community Market</b> — <code>/market/listings/440/*</code></summary>

| Feature | What it does |
|---|---|
| **Item attributes in Market listings** | The same icon engine on Market listing icons — works on both the classic and the beta Market design. |
| **Check price on PriceDB.io** | A small "↗" button on each listing row opens that exact variant's PriceDB.io page. <br/>⚠️ *Same name-based lookup caveat as above.* |

</details>

<details>
<summary><b>🎪 backpack.tf</b> — <code>stats, classifieds, profile · next.backpack.tf</code></summary>

| Feature | What it does |
|---|---|
| **Killstreak tier switcher** | Quick-switch buttons between No Kit / Killstreak / Specialized / Professional on `/stats` and `/classifieds`, plus a Sheen/Killstreaker filter (classic backpack.tf only). |
| **Spells & strange parts filter** | "Spells only" and "Strange parts only" buttons above listings — both can be on at once. |
| **Trade offer details in listing links** | Fills the "Make offer" link with the right item and price, so the trade window opens with currency already set. |
| **PriceDB.io price graph** | An embedded price graph on the item's `/stats` page, styled to match backpack.tf's native look. <br/>⚠️ *Not every item has a graph on PriceDB.io — the block just won't appear if there isn't one.* |

</details>

<details>
<summary><b>🔩 scrap.tf</b> — <code>item banking, buy/sell</code></summary>

| Feature | What it does |
|---|---|
| **Item-click links popup** | A floating, movable/resizable window on a customizable click combo (middle-click by default) with a "Check on PriceDB.io" button (and from there — Steam Market, backpack.tf, and more). <br/>⚠️ *Name-based PriceDB.io lookup caveat applies.* |

</details>

<details>
<summary><b>🔁 stntrading.eu</b> — <code>inventory, item page</code></summary>

| Feature | What it does |
|---|---|
| **Item links** | A "Check on PriceDB.io" button on the item page (and from there — Steam Market, backpack.tf, mannco.store, Skinport, Merchant.tf and more). <br/>⚠️ *Name-based PriceDB.io lookup caveat applies.* |

</details>

<details>
<summary><b>👤 Steam profile</b> — <code>steamcommunity.com/id|profiles/*</code></summary>

| Feature | What it does |
|---|---|
| **Profile links & SteamID** | Links to that user's backpack.tf, steamhistory.net (ban history included) and posts.tf, plus a SteamID64/SteamID32/SteamID button with one-click copy. |

</details>

### 🖼️ Screenshots

<p align="center">
  <b>Inventory — item attributes, live currency counter, PriceDB.io check button</b><br/><br/>
  <img src="docs/screenshots/inventory-overview.png" width="640" alt="Steam inventory with item attributes, currency counter and PriceDB.io button" />
</p>

<p align="center">
  <b>Item attributes on the Steam Community Market — classic and beta design</b><br/><br/>
  <img src="docs/screenshots/market-item-attributes-1.png" width="220" alt="Market attributes, classic list design" />
  <img src="docs/screenshots/market-item-attributes-2.png" width="220" alt="Market attributes, beta grid design" />
  <img src="docs/screenshots/market-item-attributes-3.png" width="220" alt="Market attributes, beta grid design, second item" />
  <img src="docs/screenshots/market-item-attributes-4.png" width="220" alt="Market attributes, classic list design, second item" />
</p>

<p align="center">
  <b>backpack.tf — killstreak tier switcher</b><br/><br/>
  <img src="docs/screenshots/bptf-ks-tier-buttons.png" width="640" alt="Killstreak tier switcher on backpack.tf" />
</p>

<p align="center">
  <b>scrap.tf — item-click links popup</b><br/><br/>
  <img src="docs/screenshots/scrap-item-modal.png" width="480" alt="Item-click links popup on scrap.tf" />
</p>

<p align="center">
  <b>Steam profile — links & SteamID</b><br/><br/>
  <img src="docs/screenshots/steam-profile-links.png" width="480" alt="Profile links and SteamID on a Steam profile" />
</p>

<p align="center">
  <b>The extension's own settings page</b><br/><br/>
  <img src="docs/screenshots/options-page.png" width="640" alt="TF2 Trade Suite Tools settings page" />
</p>

### ⚙️ Installation

The extension isn't published on the Chrome Web Store or Firefox AMO yet, so for now it's installed manually — it
takes about a minute.

**Option A — from a release build**

1. Go to the [Releases](../../releases) page and download the zip for your browser: `*-chrome.zip` (Chrome, Edge,
   Brave, Opera) or `*-firefox.zip` (Firefox).
2. **Chrome / Edge / Brave / Opera**: unzip the file into its own folder, open `chrome://extensions`, turn on
   **Developer mode** (top right), then click **Load unpacked** and select the unzipped folder.
3. **Firefox**: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and select the
   downloaded `.zip` (or the `manifest.json` inside the unzipped folder). Firefox removes temporary add-ons when
   the browser restarts — permanent installation would require the extension to be signed by Mozilla.

**Option B — build it yourself**

```bash
git clone https://github.com/<your-username>/tf2-trade-suite-tools.git
cd tf2-trade-suite-tools
npm install

npm run build            # Chrome / Edge / Brave / Opera (MV3) → .output/chrome-mv3
npm run build:firefox    # Firefox (MV2)                       → .output/firefox-mv2
```

Then load the resulting `.output/<browser>` folder as in step 2/3 above. Requires Node.js 18+.

### 🔒 Privacy & permissions

The extension only requests `storage` (to save your toggles and language choice locally) and `host_permissions`
for `pricedb.io`/`sku.pricedb.io`, which powers the price-check buttons. Everything else it reads is on the page
you're already on (steamcommunity.com, backpack.tf, scrap.tf, stntrading.eu) — same-origin, no separate network
permission needed. There's no analytics, no telemetry, and nothing is sent anywhere except the PriceDB.io lookups
described above.

### 🛠️ Building & contributing

Full architecture notes, the module-by-module writeup, the localization system, and the roadmap history live in
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) (Russian only, for now). Short version: every feature is one folder
under `modules/`, listed once in `utils/registry.ts`, and localized with a small `{ ru, en }` dictionary colocated
with its code.

### ⚠️ Disclaimer

This is an unofficial, community-made tool. It isn't affiliated with or endorsed by Valve, Steam, backpack.tf,
scrap.tf, or stntrading.eu. Automation features (auto-fill, quick add, instant accept) fill things in for you —
**always review an offer before confirming it**; the extension doesn't send anything on your behalf.

<p align="right"><a href="#readme-top">↑ back to top</a></p>

<br/>

<a id="russian"></a>

## 🇷🇺 Русский

### 📖 О расширении

**TF2 Trade Suite Tools** — кроссбраузерное расширение (Chrome, Firefox, Edge, Brave, Opera), которое добавляет
набор удобств поверх сайтов, которыми трейдеры TF2 пользуются каждый день: окно трейд-оффера Steam, ваш инвентарь
Steam, Торговую площадку Steam, backpack.tf, scrap.tf и stntrading.eu.

Это не один большой монолитный скрипт, а **22 независимых модуля**, каждый со своим тумблером, сгруппированных по
сайту, на котором они работают. Включайте только то, что нужно — сводку валюты в окне оффера, иконки атрибутов в
инвентаре, кнопку проверки цены на backpack.tf — а остальное держите выключенным.

### ✨ Функции

22 модуля на 8 сайтах. Нажмите на группу ниже, чтобы развернуть её.

<details>
<summary><b>🪟 Окно трейд-оффера</b> — <code>steamcommunity.com/tradeoffer/*</code></summary>

| Функция | Что делает |
|---|---|
| **Сводка валюты в кошельке** | Показывает, сколько ключей, рефов, рекламированных и скрапов есть у вас и у партнёра во *всём* инвентаре, а не только в оффере — обновляется по нажатию кнопки. |
| **Быстрое добавление предметов** | Панель прямо в окне оффера: «Добавить», «Ключи», «Металл», «Недавние», плюс быстрая очистка своей или чужой стороны. <br/>⚠️ *«Недавние» добавляет предметы по их позиции на странице — всегда проверяйте итоговый список перед отправкой.* |
| **Итог по сторонам оффера** | Под аватаром каждой стороны — сколько ключей и металла реально лежит в оффере прямо сейчас, обновляется по мере перетаскивания. Остальные предметы — числом или суммарной оценкой по ценам PriceDB.io. |
| **Автозаполнение по ссылке с backpack.tf** | Оффер открыт по ссылке с backpack.tf — сама, без единого клика, добавляет нужный предмет и валюту. <br/>⚠️ *Точный автовыбор — только для объявлений на продажу; для покупки ищет по названию и просит выбрать вручную, если подходит несколько предметов.* |
| **Кнопка «Добавить цену объявления»** | Отдельная кнопка добавляет валюту из ссылки backpack.tf по клику — независимо от автозаполнения выше. |
| **Иконки и рамки предметов в оффере** | Подсвечивает Unusual-эффект, strange-рамку, пунктир у некрафта и значки spell/strange part/killstreak прямо на иконках предметов. |

</details>

<details>
<summary><b>📋 Список офферов, история, профиль</b> — <code>/tradeoffers</code>, <code>/tradehistory</code></summary>

| Функция | Что делает |
|---|---|
| **Мгновенные Accept/Decline** | Кнопки «Принять» и «Отклонить» прямо в списке входящих офферов — не нужно открывать каждый отдельно. |
| **Отклонить все офферы разом** | Одна кнопка над списком отклоняет сразу все активные входящие офферы (с подтверждением). |
| **Группировка одинаковых предметов** | Одинаковые предметы схлопываются в один тайл со значком ×N вместо длинного повтора. |
| **Сумма валюты по офферу** | Показывает итог валюты (или число предметов, если валюты нет) отдельно для каждой стороны — в списке и истории. |

</details>

<details>
<summary><b>🎒 Инвентарь Steam</b> — <code>/profiles|id/*/inventory</code></summary>

| Функция | Что делает |
|---|---|
| **Атрибуты предметов в инвентаре** | Тот же движок иконок, что и в оффере: Unusual, strange, некрафт, значки spell/strange part/killstreak — прямо на тайлах инвентаря. |
| **Живой счётчик валюты** | Количество keys/ref/rec/scrap и общая стоимость встроены прямо в страницу инвентаря — примерная оценка по мере прокрутки, точный подсчёт — по кнопке. |
| **Проверить цену на PriceDB.io** | Кнопка в панели предмета открывает его страницу на PriceDB.io (или поиск), чтобы свериться, что цена — для нужного предмета/эффекта. <br/>⚠️ *Поиск по названию — не учитывает конкретные strange part'ы, спеллы и вариации sheen/killstreaker.* |

</details>

<details>
<summary><b>🏛️ Торговая площадка Steam</b> — <code>/market/listings/440/*</code></summary>

| Функция | Что делает |
|---|---|
| **Атрибуты предметов в листингах Market** | Тот же движок иконок на иконках листингов — работает и на классическом дизайне, и на бета-Market. |
| **Проверить цену на PriceDB.io** | Кнопка «↗» у каждой строки листинга открывает страницу именно этого варианта на PriceDB.io. <br/>⚠️ *Та же оговорка про поиск по названию.* |

</details>

<details>
<summary><b>🎪 backpack.tf</b> — <code>stats, classifieds, профиль · next.backpack.tf</code></summary>

| Функция | Что делает |
|---|---|
| **Переключение килстрик-тиров** | Быстрый переход между No Kit / Killstreak / Specialized / Professional на `/stats` и `/classifieds`, плюс фильтр по Sheen/Killstreaker (только classic backpack.tf). |
| **Фильтр spells и strange parts** | Кнопки «Только spells» и «Только strange parts» над списком объявлений — можно включить обе сразу. |
| **Параметры оффера в ссылках листингов** | Дополняет ссылку «Предложить сделку» нужным предметом и ценой — окно оффера открывается с уже выставленной валютой. |
| **График цены PriceDB.io** | Встроенный график цены на странице предмета (`/stats`), в родном стиле backpack.tf. <br/>⚠️ *График есть не для каждого предмета — если его нет на PriceDB.io, блок просто не появится.* |

</details>

<details>
<summary><b>🔩 scrap.tf</b> — <code>item banking, buy/sell</code></summary>

| Функция | Что делает |
|---|---|
| **Окошко ссылок по клику на предмет** | Плавающее окошко (двигается, меняется в размере) по настраиваемой комбинации клика (по умолчанию — средняя кнопка мыши) с кнопкой «Проверить на PriceDB.io» (а оттуда — Steam Market, backpack.tf и другие). <br/>⚠️ *Та же оговорка про поиск по названию.* |

</details>

<details>
<summary><b>🔁 stntrading.eu</b> — <code>инвентарь, страница предмета</code></summary>

| Функция | Что делает |
|---|---|
| **Ссылки на предмет** | Кнопка «Проверить на PriceDB.io» на странице предмета (а оттуда — Steam Market, backpack.tf, mannco.store, Skinport, Merchant.tf и другие). <br/>⚠️ *Та же оговорка про поиск по названию.* |

</details>

<details>
<summary><b>👤 Профиль Steam</b> — <code>steamcommunity.com/id|profiles/*</code></summary>

| Функция | Что делает |
|---|---|
| **Ссылки и SteamID на профиле** | Ссылки на backpack.tf, steamhistory.net (включая бан-историю) и posts.tf этого пользователя, плюс кнопка SteamID64/SteamID32/SteamID с копированием в один клик. |

</details>

### 🖼️ Скриншоты

<p align="center">
  <b>Инвентарь — атрибуты предметов, живой счётчик валюты, кнопка проверки на PriceDB.io</b><br/><br/>
  <img src="docs/screenshots/inventory-overview.png" width="640" alt="Инвентарь Steam с атрибутами предметов, счётчиком валюты и кнопкой PriceDB.io" />
</p>

<p align="center">
  <b>Атрибуты предметов в листингах Steam Market — классический и бета-дизайн</b><br/><br/>
  <img src="docs/screenshots/market-item-attributes-1.png" width="220" alt="Атрибуты Market, классический список" />
  <img src="docs/screenshots/market-item-attributes-2.png" width="220" alt="Атрибуты Market, бета-сетка" />
  <img src="docs/screenshots/market-item-attributes-3.png" width="220" alt="Атрибуты Market, бета-сетка, другой предмет" />
  <img src="docs/screenshots/market-item-attributes-4.png" width="220" alt="Атрибуты Market, классический список, другой предмет" />
</p>

<p align="center">
  <b>backpack.tf — переключение килстрик-тиров</b><br/><br/>
  <img src="docs/screenshots/bptf-ks-tier-buttons.png" width="640" alt="Переключение килстрик-тиров на backpack.tf" />
</p>

<p align="center">
  <b>scrap.tf — окошко ссылок по клику на предмет</b><br/><br/>
  <img src="docs/screenshots/scrap-item-modal.png" width="480" alt="Окошко ссылок по клику на предмет на scrap.tf" />
</p>

<p align="center">
  <b>Профиль Steam — ссылки и SteamID</b><br/><br/>
  <img src="docs/screenshots/steam-profile-links.png" width="480" alt="Ссылки и SteamID на профиле Steam" />
</p>

<p align="center">
  <b>Страница настроек самого расширения</b><br/><br/>
  <img src="docs/screenshots/options-page.png" width="640" alt="Страница настроек TF2 Trade Suite Tools" />
</p>

### ⚙️ Установка

Расширение пока не опубликовано в Chrome Web Store или Firefox AMO, так что ставится вручную — это займёт около
минуты.

**Вариант A — из готовой сборки**

1. Откройте страницу [Releases](../../releases) и скачайте архив для своего браузера: `*-chrome.zip` (Chrome, Edge,
   Brave, Opera) или `*-firefox.zip` (Firefox).
2. **Chrome / Edge / Brave / Opera**: распакуйте архив в отдельную папку, откройте `chrome://extensions`, включите
   **Режим разработчика** (справа сверху), нажмите **Загрузить распакованное расширение** и выберите папку.
3. **Firefox**: откройте `about:debugging#/runtime/this-firefox`, нажмите **Загрузить временное дополнение…** и
   выберите скачанный `.zip` (или `manifest.json` внутри распакованной папки). Firefox удаляет временные дополнения
   при перезапуске браузера — для постоянной установки расширение должно быть подписано Mozilla.

**Вариант B — собрать самому**

```bash
git clone https://github.com/<your-username>/tf2-trade-suite-tools.git
cd tf2-trade-suite-tools
npm install

npm run build            # Chrome / Edge / Brave / Opera (MV3) → .output/chrome-mv3
npm run build:firefox    # Firefox (MV2)                       → .output/firefox-mv2
```

Дальше загрузите получившуюся папку `.output/<browser>` как в шаге 2/3 выше. Нужен Node.js 18+.

### 🔒 Приватность и разрешения

Расширению нужны только разрешение `storage` (хранить ваши тумблеры и выбор языка локально) и
`host_permissions` для `pricedb.io`/`sku.pricedb.io` — это то, что питает кнопки проверки цены. Всё остальное оно
читает прямо со страницы, на которой вы уже находитесь (steamcommunity.com, backpack.tf, scrap.tf, stntrading.eu) —
это same-origin, отдельное сетевое разрешение не нужно. Никакой аналитики и телеметрии — никуда ничего не
отправляется, кроме запросов к PriceDB.io, описанных выше.

### 🛠️ Разработка и вклад в проект

Полное описание архитектуры, документация по каждому модулю, система локализации и история дорожной карты — в
[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md). Коротко: каждая функция — отдельная папка в `modules/`, один раз
указанная в `utils/registry.ts`, и локализуется маленьким словарём `{ ru, en }` рядом со своим кодом.

### ⚠️ Дисклеймер

Это неофициальный, любительский инструмент. Он не связан с Valve, Steam, backpack.tf, scrap.tf или stntrading.eu и
не одобрен ими. Функции автоматизации (автозаполнение, быстрое добавление, мгновенный accept) заполняют оффер за
вас — **всегда проверяйте оффер перед подтверждением**; само расширение ничего не отправляет от вашего имени.

<p align="right"><a href="#readme-top">↑ наверх</a></p>

---

<p align="center">
  Built by <a href="https://steamcommunity.com/profiles/76561198038152985/"><b>Warrvin</b></a> with
  <a href="https://claude.com/claude-code">Claude Code</a>.<br/>
  <sub>Built on ideas from Steam Trade Offer Enhancer (juliarose fork), tf2trader (offish/tf2-trader) and tf2TradingUtils.</sub>
</p>
