import { test, expect } from '@playwright/test';

test('2, 3 and 4 pending towers remain independently selectable and placeable', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await expect(page.locator('#choices .choice')).toHaveCount(3);
  await page.locator('#choices .choice').first().click();
  await expect(page.locator('[data-pending-id]')).toHaveCount(1);

  await page.evaluate(() => {
    window.__fiveElementsTest.reset();
    window.__fiveElementsTest.addPending(['金','木']);
  });
  await expect(page.locator('[data-pending-id]')).toHaveCount(2);
  const ids2 = await page.locator('[data-pending-id]').evaluateAll(es => es.map(e => Number(e.dataset.pendingId)));
  await page.locator(`[data-pending-id="${ids2[1]}"]`).click();
  await expect(page.locator(`[data-pending-id="${ids2[1]}"]`)).toHaveAttribute('aria-pressed','true');
  await page.locator(`[data-pending-id="${ids2[0]}"]`).click();
  await expect(page.locator(`[data-pending-id="${ids2[0]}"]`)).toHaveAttribute('aria-pressed','true');

  await page.evaluate(() => { window.__fiveElementsTest.reset(); window.__fiveElementsTest.addPending(['金','木','水']); });
  await expect(page.locator('[data-pending-id]')).toHaveCount(3);
  const ids3 = await page.locator('[data-pending-id]').evaluateAll(es => es.map(e => Number(e.dataset.pendingId)));
  for (const id of [ids3[2], ids3[0], ids3[1]]) {
    await page.locator(`[data-pending-id="${id}"]`).click();
    await expect(page.locator(`[data-pending-id="${id}"]`)).toHaveAttribute('aria-pressed','true');
  }

  await page.evaluate(() => { window.__fiveElementsTest.reset(); window.__fiveElementsTest.addPending(['金','木','水','火']); });
  await expect(page.locator('[data-pending-id]')).toHaveCount(4);
  const ids4 = await page.locator('[data-pending-id]').evaluateAll(es => es.map(e => Number(e.dataset.pendingId)));
  const points = [[450,130],[500,300],[250,350],[700,650]];
  for (let i = 0; i < ids4.length; i++) {
    const id = ids4[[2,0,3,1][i]];
    await page.locator(`[data-pending-id="${id}"]`).click();
    await expect(page.locator(`[data-pending-id="${id}"]`)).toHaveAttribute('aria-pressed','true');
    const box = await page.locator('#game').boundingBox();
    if (!box) throw new Error('game canvas missing');
    const [x,y] = points[i];
    await page.mouse.click(box.x + x/900*box.width, box.y + y/700*box.height);
    await expect(page.locator(`[data-pending-id="${id}"]`)).toHaveCount(0);
  }
  await expect(page.locator('[data-pending-id]')).toHaveCount(0);
});
