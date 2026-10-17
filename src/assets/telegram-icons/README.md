# Telegram icons

Иконки взяты из набора [telegram-icons](https://github.com/gradosphera/telegram-icons)
(исходники — community Figma UI-киты Telegram, лицензия **CC BY 4.0**).

Здесь лежит только подмножество, реально используемое в приложении:

- `ios/` — набор из Telegram iOS UI Kit;
- `android/` — набор из Telegram Android UI Kit.

Цвет заливки нормализован в `currentColor`, чтобы иконки наследовали цвет
текста/темы. Компонент-обёртка — `src/components/TgIcon.tsx`, он сам выбирает
набор по платформе устройства.

Не аффилировано с Telegram.
