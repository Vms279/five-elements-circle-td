import { test, expect } from '@playwright/test';

test('one card can be dragged from the warehouse onto the map', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button', { name: /塔卡/ }).first().click();
  await page.locator('#debugCards').click();
  const cards = page.locator('#build [data-card-id]');
  await expect(cards).toHaveCount(4);
  const first = cards.first();
  const box = await first.boundingBox();
  const canvas = page.locator('#game');
  const cb = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(cb).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width * .56, cb.y + cb.height * .50, { steps: 12 });
  await page.mouse.up();
  await expect(cards).toHaveCount(3);
});

test('four independent cards can be placed in arbitrary order', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button', { name: /塔卡/ }).first().click();
  await page.locator('#debugCards').click();
  const cards = page.locator('#build [data-card-id]');
  await expect(cards).toHaveCount(4);
  const ids = await cards.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-card-id')));
  const positions = [[.56,.50],[.64,.50],[.56,.62],[.64,.62]];
  for (let i = ids.length - 1; i >= 0; i--) {
    const card = page.locator(`[data-card-id="${ids[i]}"]`);
    const box = await card.boundingBox();
    const cb = await page.locator('#game').boundingBox();
    expect(box).not.toBeNull();
    expect(cb).not.toBeNull();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(cb.x + cb.width * positions[i][0], cb.y + cb.height * positions[i][1], { steps: 12 });
    await page.mouse.up();
  }
  await expect(cards).toHaveCount(0);
  await expect(page.locator('#debug')).toContainText('塔实体 4');
});

test('same card quantity can be stored and deployed twice', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button', { name: /塔卡/ }).first().click();
  await page.locator('#debugCards').click();
  await page.locator('#debugCards').click();
  const cards = page.locator('#build [data-card-id]');
  await expect(cards).toHaveCount(4);
  const first = cards.first();
  await expect(first.locator('b')).toHaveText('×2');
  const box = await first.boundingBox();
  const cb = await page.locator('#game').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(cb.x + cb.width * .56, cb.y + cb.height * .50, { steps: 12 });
  await page.mouse.up();
  await expect(first.locator('b')).toHaveText('×1');
});
