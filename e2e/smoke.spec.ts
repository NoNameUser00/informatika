import { expect, test } from '@playwright/test';

// Главная: герой, маскот, список классов.
test('homepage renders hero and grades', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /теория/i })).toBeVisible();
  await expect(page.getByText('7 класс', { exact: true })).toBeVisible();
  await expect(page.getByText('11 класс', { exact: true })).toBeVisible();
});

// Тренажёр 8 класса: ФИО → вопросы видны, ответы вводятся.
test('trainer flow answers questions', async ({ page }) => {
  await page.goto('./8/trainer/');
  await page.locator('#surname').fill('Тестов');
  await page.locator('#firstname').fill('Тест');
  await page.locator('#klass').selectOption('8');
  await page.locator('#letter').selectOption('Ч');
  await page.locator('#consent').check({ force: true });
  await page.getByRole('button', { name: /далее/i }).click();
  await expect(page.getByText(/вопрос \d/i).first()).toBeVisible();
  // отвечаем на первый вопрос страницы (радио или ввод)
  const firstQ = page.locator('fieldset.q').first();
  await expect(firstQ).toBeVisible();
  const radio = firstQ.locator('input[type="radio"]').first();
  const text = firstQ.locator('input[placeholder="только число"]');
  if (await radio.count()) {
    await radio.check({ force: true });
  } else {
    await text.fill('101');
  }
  await expect(page.getByRole('button', { name: /далее|проверить|ответить/i }).first()).toBeVisible();
});

// Страница 404 с игрой: канвас и кнопка старта на месте.
test('404 game page loads', async ({ page }) => {
  await page.goto('./takoi-stranitsy-net/');
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.getByRole('button', { name: /старт/i })).toBeVisible();
});

// Доска открывается без ошибок React (регрессия: инлайн excalidrawAPI зацикливал рендеры).
test('board opens without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto('./');
  await page.getByRole('button', { name: /доску для черновиков/i }).click();
  await expect(page.locator('.board-window')).toBeVisible();
  await expect(page.locator('.board-window canvas').first()).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(2000);
  expect(errors).toEqual([]);
});

// Учительская без бэкенда: демо-гейт, страница не падает.
test('teacher page shows gate without backend', async ({ page }) => {
  await page.goto('./teacher/');
  await expect(page.getByText(/учител/i).first()).toBeVisible();
});
