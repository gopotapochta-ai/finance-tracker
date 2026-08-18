# Design spec — Living Moleskine

**Date:** 2026-08-18
**Repo:** `F:/diet` — PWA «Финансы — Трекер»
**Status:** Draft, awaiting user approval

## Goal

Превратить статичный Moleskine-дизайн в «живую тетрадку»: оркестрированный motion поверх
существующего layout/палитры/типографики. Без смены визуального языка, без потери уже
утверждённой эстетики.

## Non-goals

- Смена палитры, шрифтов, метафоры
- Новые экраны или фичи
- Изменения backend / cloud sync
- Refactor `index.html` структуры (single-file constraint)

---

## Section 1 — Stack additions

| Layer | Tool | Size | Why |
|---|---|---|---|
| Motion orchestrator | GSAP 3.12 via CDN (`cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js`) | ~50KB gz | Единая easing vocabulary, scroll triggers, FLIP, orchestration across many elements |
| Detection | `gsap.matchMedia()` | 0 (in GSAP) | prefers-reduced-motion gate |
| Existing | Tailwind CDN, Chart.js 4.4.8, Google Fonts | unchanged | — |
| Service worker | `sw.js` CACHE_VERSION bump `2026-08-18-r1` → `2026-08-18-r2` | — | чтобы юзеры получили новый билд |

**Load order:**
```html
<head>
  ...
  <script defer src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js</script>
</head>
```
GSAP загружается `defer` — не блокирует first paint. Анимации стартуют после `DOMContentLoaded`.

---

## Section 2 — Hero animation: Ink-write balance

Это визитная карточка спека — то, что юзер видит первым.

**Техника:** SVG-копия текста баланса, рисуется через `stroke-dasharray`/`stroke-dashoffset`.
Эффект «цифры проявляются как чернила».

**Анатомия:**
1. `<span class="balance-amount" id="dashBalance">194 500,00</span>` — обычный текст для
   скринридеров, скрыт через `aria-hidden` дубликат-SVG рисуется поверх.
2. SVG-overlay `<svg viewBox="0 0 W H">` с `<text>` тем же шрифтом/кеглем, контурным stroke
   без fill. `stroke-dasharray = pathLength`, `stroke-dashoffset` анимируется `pathLength → 0`.
3. После завершения draw (800ms) — fill терракотовым цветом, opacity 0 → 1, 240ms.
4. Единица `₽` появляется с overshoot (rotate -8° → 0° + scale 0.6 → 1.05 → 1), 320ms, delay 800ms.

**Easing:** `power3.out` для draw (быстрый старт, плавный финиш).
**Duration:** 800ms draw + 240ms fill + 320ms unit = 1360ms total.
**Reduced-motion:** instant fade-in 200ms, без stroke draw.

**Где повторно используется:**
- НЕ повторяется при обновлении данных (только mount) — иначе раздражает.
- Mini-stats (Сегодня / 7 дней) — вместо draw используется number-tween через GSAP
  (`{snap: 0.01}`, duration 600ms) — дешевле, читается лучше для маленьких цифр.

---

## Section 3 — Per-screen sketch

### Dashboard
- Mount sequence (stagger 80ms):
  1. Header «Финансы» + LEDGER стикер — fade-up 320ms
  2. Balance label «ТЕКУЩИЙ БАЛАНС» — fade-up 280ms
  3. **Hero: ink-write баланса** (1360ms)
  4. MTD Доход/Расход row — slide-from-left + slide-from-right, 320ms each
  5. Mini stats Сегодня / 7 дней — number-tween 600ms
  6. Doughnut — sectors draw clockwise 1.2s, ease `power2.out`
  7. Line chart (Динамика) — path stroke left→right 1.5s
- Общая длительность mount: ~1500ms до состояния «готово».

### History
- При смене экрана: каждая транзакция въезжает slide-from-right + fade, stagger 40ms.
- Скролл: левая «ink» граница каждой записи заполняется при попадании в viewport
  (ScrollTrigger, batch).

### Analytics
- Большие чарты: оси рисуются первыми (320ms), затем данные (как на dashboard).

### Budgets
- Progress bars: `width: 0 → actual%` за 800ms с overshoot `back.out(1.2)`.
- Если лимит >80%: subtle pulse loop (scale 1 ↔ 1.02, 2s, бесконечно).
- Если лимит превышен: bar становится кирпичным с глитч-встряской 200ms один раз.

### Settings
- Список категорий: drag-to-reorder через FLIP (`Flip.fit()` + `Flip.from()`).
- Cloud sync кнопка: при fetch — иконка превращается в крутящийся «карандашный штрих»
  (SVG path animation 360° loop).

### Add transaction modal
- Open: paper slide-up from bottom (translateY 100% → 0, 280ms) + slight rotateX
  (8° → 0, 240ms) + shadow rise.
- Close: reverse, 240ms.
- FAB → × трансформация на 280ms параллельно с open.

### FAB (глобально)
- Idle: subtle breathing (scale 1 ↔ 1.03, 4s loop, ease `sine.inOut`).
- Hover: translateY -2px + shadow expand 200ms.
- Tap: spring scale 0.88 → 1.08 → 1, total 380ms (`elastic.out(1, 0.5)`).
- Active (модалка открыта): rotate 45° → 1 (становится ×), 280ms.

### Bottom nav
- Switch: активный индикатор скользит между табами с пружиной
  (`x: {duration: 0.4, ease: "back.out(1.7)"}`).
- Активный лейбл: микро-«ink» анимация цвета (терракотовый fade-in 200ms).

### Page transitions (`switchScreen`)
- Paper page-turn: outgoing screen `rotateY: 0 → -8°, opacity: 1 → 0.6` 280ms,
  incoming — противоположно с задержкой 60ms. Тень по левому краю outgoing усиливается.
- Альтернатива если 3D не зайдёт: simple slide-up с параллаксом по фону.

---

## Section 4 — Easing vocabulary (locked)

| Use case | Easing | Duration |
|---|---|---|
| Hero ink-write | `power3.out` | 800ms |
| Mount fade-up | `power2.out` | 280–320ms |
| Sticker peel / FAB tap | `elastic.out(1, 0.5)` | 380ms |
| Number tween | `power2.inOut` | 600ms |
| Progress bar fill | `back.out(1.2)` | 800ms |
| Page transition | `power4.inOut` | 280ms |
| Modal slide | `expo.out` | 280ms |
| Micro hover | custom `cubic-bezier(0.4, 0, 0.2, 1)` | 150–200ms |

`ease-in-out` НЕ используется нигде — анти-паттерн (impeccable rule #37).

---

## Section 5 — Performance & accessibility

**Performance:**
- Анимации только на `transform` и `opacity` (GPU).
- `will-change: transform` только во время активной анимации; чистится через `onComplete`.
- Никаких layout-thrashing анимаций (никаких width/height tween).
- GSAP грузится `defer`, не блокирует FCP.

**Accessibility:**
- `prefers-reduced-motion: reduce` → все анимации заменяются instant opacity/transform changes
  через `gsap.matchMedia("(prefers-reduced-motion: no-preference)", ...)`.
- Фокус-кольца не маскируются анимациями.
- Текст баланса остаётся в DOM (для скринридеров), SVG-overlay — чисто визуальный.

**Service worker:**
- Bump `CACHE_VERSION` в `sw.js` (и `sw2.js` если активен).
- Юзеру нужен hard refresh (Ctrl+Shift+R) для получения нового билда, либо кнопка
  «Сброс кэша» в Диагностике.

---

## Section 6 — Acceptance criteria

- [ ] Hard refresh показывает ink-write баланса на dashboard (видимо: цифры проявляются слева направо, ~1.4с)
- [ ] FAB дышит в idle (видимо при наблюдении 5+ секунд)
- [ ] Тап по FAB: пружинное сжатие → модалка открывается снизу → FAB стал ×
- [ ] Переключение табов в bottom nav: индикатор скользит с overshoot
- [ ] Открытие экрана История/Аналитика/Лимиты/Категории: paper page-turn
- [ ] Новая транзакция появляется с slide-from-right + ink checkmark (на dashboard или history)
- [ ] Doughnut на dashboard: сектора рисуются по часовой стрелке за ~1.2с
- [ ] Reduced-motion (включить в OS): анимации заменяются instant переходами, layout цел
- [ ] Lighthouse perf score не ниже baseline −5 пунктов
- [ ] Service worker bump → юзер получает новый билд после hard refresh

---

## Section 7 — Risk register

| Risk | Mitigation |
|---|---|
| GSAP 50KB + деfer → задержка первой анимации на 100-200ms | Принять. Мигание DOM без motion — приемлемо. |
| Overdo: слишком много движения → отвлекает от данных | Правило delight (impeccable #17): максимум 1-2 motion-момента на экран |
| Page-turn 3D ломает скролл / создаёт мусор на слабых устройствах | `@media (prefers-reduced-motion)` + fallback на slide |
| FLIP для categories re-order даёт баги при drag | Использовать proven `Flip` API, fallback на instant reorder |
| Service worker не доставляет новый билд | Bump CACHE_VERSION + уведомление «обнови страницу» через toast |

---

## Section 8 — Files to modify

- `index.html` — основная работа (~+200-300 строк: GSAP init, animation primitives, новые стили)
- `sw.js` — CACHE_VERSION bump
- `sw2.js` — CACHE_VERSION bump (если активен)
- `memory/CURRENT.md` — запись прогресса после каждой фазы

---

## Open questions (для обсуждения)

1. **FAB breathing в idle — не отвлекает?** Если да, можно сделать только при первом
   появлении (3 цикла, потом стоп).
2. **Page-turn на слабых устройствах** — нужен ли автоматический fallback на slide?
   Или просто уважаем `prefers-reduced-motion`?
3. **Drag-to-reorder категорий** — стоит ли делать в этом проходе, или вынести в v1.3?

---

## Pending sections (покажу по апруву секций 1-3)

- Section 9: Animation primitives API (что выносим в переиспользуемые функции)
- Section 10: Тестирование (smoke checklist)
- Section 11: Rollout plan (phased или всё разом)
