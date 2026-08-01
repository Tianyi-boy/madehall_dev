async page => {
  await page.reload();
  await page.evaluate(() => window.MADEHALL.switchView('c'));
  const c = page.locator('#c-frame').contentFrame();
  await c.locator('#loginView').waitFor({ state: 'visible' });
  for (let i = 0; i < 100; i++) {
    const ready = await c.locator('body').evaluate(body => typeof body.ownerDocument.defaultView.applyRole === 'function');
    if (ready) break;
    await page.waitForTimeout(20);
  }
  const inputs = c.locator('#loginView input');
  await inputs.nth(0).fill('audit');
  await inputs.nth(1).fill('audit');
  await c.locator('#loginBtn').click();
  await c.locator('#roleSel').selectOption('root（系统管理员）');
  const call = (name, args = []) => c.locator('body').evaluate((body, payload) => body.ownerDocument.defaultView[payload.name].apply(null, payload.args), { name, args });

  await call('goZone', ['z2']);
  const gidBefore = {
    disabled: await c.locator('#btnGidConfirm').isDisabled(),
    queueState: await c.locator('#z2ExcTbl tbody tr').getAttribute('data-qstate'),
    status: (await c.locator('#z2bWQ').innerText()).trim()
  };
  await c.locator('#gidInput').fill('gid://shopify/Company/9001');
  const gidReady = { disabled: await c.locator('#btnGidConfirm').isDisabled(), hint: (await c.locator('#gidHint').innerText()).trim() };
  await c.locator('#btnGidConfirm').click();
  const gidAfter = {
    queueState: await c.locator('#z2ExcTbl tbody tr').getAttribute('data-qstate'),
    status: (await c.locator('#z2bWQ').innerText()).trim(),
    stepper: await c.locator('#z2step .step').evaluateAll(elements => elements.map(element => [element.className, element.querySelector('.c').textContent])),
    timelineFirst: (await c.locator('#tlZ1 li').first().innerText()).trim().replace(/\s+/g, ' ')
  };

  const merchantRow = c.locator('#z2bXA').locator('xpath=ancestor::tr');
  await merchantRow.getByRole('button', { name: '资料变更' }).click();
  const merchantBefore = { disabled: await c.locator('#btnMerSave').isDisabled(), logDisplay: await c.locator('#mfLog').evaluate(element => getComputedStyle(element).display) };
  await c.locator('#mfReason').fill('更新回归联系人资料');
  const merchantReady = { disabled: await c.locator('#btnMerSave').isDisabled(), hint: (await c.locator('#mfHint').innerText()).trim() };
  await c.locator('#btnMerSave').click();
  const merchantAfter = {
    logDisplay: await c.locator('#mfLog').evaluate(element => getComputedStyle(element).display),
    logText: (await c.locator('#mfLog').innerText()).trim().replace(/\s+/g, ' '),
    timelineFirst: (await c.locator('#tlZ1 li').first().innerText()).trim().replace(/\s+/g, ' ')
  };
  await c.locator('#mMerchant button[data-close]').click();

  await call('goZone', ['z5']);
  await c.locator('[data-goto-tab="z5-make"]').first().click();
  const cutBefore = { disabled: await c.locator('#btnCut').isDisabled() };
  await c.locator('#cutReason').fill('客户批准本单例外核减');
  const cutReady = { disabled: await c.locator('#btnCut').isDisabled(), hint: (await c.locator('#cutHint').innerText()).trim() };
  await c.locator('#btnCut').click();
  const cutAfter = {
    boxDisplay: await c.locator('#z5cutBox').evaluate(element => getComputedStyle(element).display),
    timelineFirst: (await c.locator('#tlZ5 li').first().innerText()).trim().replace(/\s+/g, ' ')
  };

  await call('goZone', ['z6']);
  await c.locator('#prodState').selectOption('shipped');
  const shipBefore = { disabled: await c.locator('#btnProdFill').isDisabled(), gate: (await c.locator('#shipGateHint').innerText()).trim() };
  await c.locator('#chkShipBal').check();
  const shipReady = { disabled: await c.locator('#btnProdFill').isDisabled(), gate: (await c.locator('#shipGateHint').innerText()).trim() };
  await c.locator('#btnProdFill').click();
  const order2024 = c.locator('#orderTbl tbody tr').filter({ hasText: 'SO-2024' }).first();
  const shipAfter = {
    status: (await order2024.locator('td').nth(2).innerText()).trim(),
    timelineFirst: (await c.locator('#tlZ6 li').first().innerText()).trim().replace(/\s+/g, ' ')
  };

  const closeBefore = { disabled: await c.locator('#btnClose').isDisabled(), hint: (await c.locator('#closeHint').innerText()).trim() };
  await c.locator('#chkBalance').check();
  await c.locator('#chkKit').check();
  const closeReady = { disabled: await c.locator('#btnClose').isDisabled(), hint: (await c.locator('#closeHint').innerText()).trim() };
  await c.locator('#btnClose').click();
  const order2018 = c.locator('#orderTbl tbody tr').filter({ hasText: 'SO-2018' }).first();
  const closeAfter = {
    status: (await order2018.locator('td').nth(2).innerText()).trim(),
    timelineFirst: (await c.locator('#tlZ6 li').first().innerText()).trim().replace(/\s+/g, ' ')
  };

  await call('goZone', ['zsys']);
  const rowsBefore = await c.locator('#zsys table.tbl tbody tr').count();
  await c.locator('#zsys [data-modal="mSysNew"]').click();
  const newBefore = { disabled: await c.locator('#btnSysNew').isDisabled() };
  await c.locator('#sysNewAcct').fill('audit.user');
  await c.locator('#sysNewName').fill('回归用户');
  await c.locator('#sysNewRole').selectOption('客服专员');
  const newReady = { disabled: await c.locator('#btnSysNew').isDisabled(), hint: (await c.locator('#sysNewHint').innerText()).trim() };
  await c.locator('#btnSysNew').click();
  const newAfter = {
    rows: await c.locator('#zsys table.tbl tbody tr').count(),
    addedText: (await c.locator('#zsys table.tbl tbody tr').last().innerText()).trim().replace(/\s+/g, ' '),
    timelineFirst: (await c.locator('#tlSys li').first().innerText()).trim().replace(/\s+/g, ' ')
  };

  return {
    gid: { before: gidBefore, ready: gidReady, after: gidAfter },
    merchantSave: { before: merchantBefore, ready: merchantReady, after: merchantAfter },
    cut: { before: cutBefore, ready: cutReady, after: cutAfter },
    ship: { before: shipBefore, ready: shipReady, after: shipAfter },
    close: { before: closeBefore, ready: closeReady, after: closeAfter },
    sysNew: { rowsBefore, before: newBefore, ready: newReady, after: newAfter }
  };
}
