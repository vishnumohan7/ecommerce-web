import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('direct URL and hard refresh remain behind the middleware gate', async ({ page }) => {
  await page.goto('/alcohol');
  await expect(page).toHaveURL(/\/alcohol$/);
  await expect(page.getByRole('alertdialog', { name: 'Are you 18 or over?' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('alertdialog', { name: 'Are you 18 or over?' })).toBeVisible();
});

test('No returns home with a dismissible notice and Escape has the same safe outcome', async ({
  page,
}) => {
  await page.goto('/alcohol');
  await page.getByRole('button', { name: 'No, take me home' }).click();
  await expect(page).toHaveURL(/\/?ageGate=declined$/);
  await expect(page.getByRole('status')).toContainText('Alcohol browsing was closed');
  await expect(page.getByRole('link', { name: 'Dismiss' })).toBeVisible();
  await page.goto('/category/alcohol/wine');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/?ageGate=declined$/);
});

test('keyboard-only confirmation is focus-trapped and survives refresh', async ({
  page,
  context,
}) => {
  await page.goto('/alcohol');
  const yes = page.getByRole('button', { name: 'Yes, I am 18 or over' });
  const no = page.getByRole('button', { name: 'No, take me home' });
  await expect(yes).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(no).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(yes).toBeFocused();
  await yes.press('Enter');
  await expect(page.getByRole('heading', { name: 'Beer, wine and spirits' })).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === 'age_gate')).toMatchObject({
    httpOnly: true,
    sameSite: 'Lax',
  });
  await page.reload();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('shared nested links and alcohol-filtered search are intercepted', async ({ page }) => {
  await page.goto('/alcohol/wine?offer=true');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.goto('/search?alcohol=true');
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('age gate has zero serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/alcohol');
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking).toEqual([]);
});
