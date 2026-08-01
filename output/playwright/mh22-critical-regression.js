async page => {
  const frame = key => page.locator('#' + key.toLowerCase() + '-frame').contentFrame();

  async function reset(key) {
    await page.reload();
    await page.evaluate(key => window.MADEHALL.switchView(key.toLowerCase()), key);
    const target = frame(key);
    const anchor = key === 'A' ? '#page-merchant' : (key === 'B' ? '#pg-orders' : '#loginView');
    await target.locator(anchor).waitFor({ state: 'attached' });
    const runtimeFn = key === 'A' ? 'showPage' : (key === 'B' ? 'openOrder' : 'applyRole');
    for (let i = 0; i < 100; i++) {
      const ready = await target.locator('body').evaluate((body, name) => typeof body.ownerDocument.defaultView[name] === 'function', runtimeFn);
      if (ready) {
        await page.waitForTimeout(150);
        return target;
      }
      await page.waitForTimeout(20);
    }
    throw new Error('runtime not ready: ' + key + '.' + runtimeFn);
  }

  async function call(target, name, args = []) {
    return target.locator('body').evaluate((body, payload) => {
      const fn = body.ownerDocument.defaultView[payload.name];
      if (typeof fn !== 'function') throw new Error('missing frame function: ' + payload.name);
      return fn.apply(null, payload.args);
    }, { name, args });
  }

  async function loginC() {
    await page.evaluate(() => window.MADEHALL.switchView('c'));
    const c = await reset('C');
    const inputs = c.locator('#loginView input');
    await inputs.nth(0).fill('audit');
    await inputs.nth(1).fill('audit');
    await c.locator('#loginView button').filter({ hasText: '登录' }).click();
    await c.locator('#roleSel').selectOption('root（系统管理员）');
    return c;
  }

  async function auditMerchant(action) {
    const c = await loginC();
    const config = {
      pass: { modal: 'mPass', act: 'm.z1pass', state: 'provisioning' },
      returned: { modal: 'mReturn', act: 'm.z1return', state: 'need_info' },
      rejected: { modal: 'mReject', act: 'm.z1reject', state: 'rejected' }
    }[action];
    const row = c.locator('#z1QueueTbl tbody tr[data-merchant="西岸办公家具批发（美）"]');
    const before = {
      state: await row.getAttribute('data-astate'),
      status: (await row.locator('td').nth(3).innerText()).trim(),
      timelineCount: await c.locator('#tlZ1 li').count()
    };
    await row.locator(`[data-modal="${config.modal}"]`).click();
    if (config.modal !== 'mPass') await c.locator('#' + config.modal + ' textarea').fill('回归证据：原因已填写');
    await c.locator(`[data-act="${config.act}"]`).click();
    const after = {
      state: await row.getAttribute('data-astate'),
      status: (await row.locator('td').nth(3).innerText()).trim(),
      operation: (await row.locator('td').nth(4).innerText()).trim().replace(/\s+/g, ' '),
      timelineFirst: (await c.locator('#tlZ1 li').first().innerText()).trim().replace(/\s+/g, ' ')
    };
    return { expected: config.state, before, after };
  }

  async function contactLinks() {
    await page.evaluate(() => window.MADEHALL.switchView('a'));
    let a = await reset('A');
    await a.locator('.protobar [data-goto="page-merchant"]').click();
    const lead = a.locator('#page-merchant .lead a[data-goto="page-contact"]');
    const leadCount = await lead.count();
    await lead.click();
    const leadTarget = await a.locator('#page-contact').evaluate(element => element.classList.contains('on'));

    a = await reset('A');
    await a.locator('.protobar [data-goto="page-merchant"]').click();
    await a.locator('#mstab2').click();
    await a.locator('#sstab4').click();
    const card = a.locator('#ssv4 .stbanner a[data-goto="page-contact"]');
    const cardCount = await card.count();
    await card.click();
    const cardTarget = await a.locator('#page-contact').evaluate(element => element.classList.contains('on'));
    return { leadCount, leadTarget, cardCount, cardTarget };
  }

  async function suspendResume() {
    const c = await loginC();
    await call(c, 'goZone', ['z2']);
    const row = c.locator('#z2bXA').locator('xpath=ancestor::tr');
    const before = {
      state: await row.getAttribute('data-mstate'),
      status: (await row.locator('td').nth(1).innerText()).trim()
    };
    await row.locator('[data-modal="mSuspend"]').click();
    await c.locator('[data-act="m.z2suspend"]').click();
    const suspended = {
      state: await row.getAttribute('data-mstate'),
      status: (await row.locator('td').nth(1).innerText()).trim(),
      timelineFirst: (await c.locator('#tlZ1 li').first().innerText()).trim().replace(/\s+/g, ' ')
    };
    await row.locator('[data-act="m.z2resume"]').click();
    const resumed = {
      state: await row.getAttribute('data-mstate'),
      status: (await row.locator('td').nth(1).innerText()).trim(),
      timelineFirst: (await c.locator('#tlZ1 li').first().innerText()).trim().replace(/\s+/g, ' ')
    };
    return { before, suspended, resumed };
  }

  async function quotePublish() {
    const c = await loginC();
    await call(c, 'goZone', ['z5']);
    await c.locator('[data-goto-tab="z5-make"]').first().click();
    const steps = () => c.locator('#z5eyes .step').evaluateAll(elements => elements.map(element => ({
      cls: element.className,
      mark: element.querySelector('.c').textContent,
      text: element.querySelector('p').textContent
    })));
    const initial = await steps();
    await c.locator('#corrPrice').fill('30000');
    await c.locator('[data-act="z5.toReview"]').click();
    const review = await steps();
    await c.locator('[data-act="z5.reviewOk"]').click();
    const publishReady = await steps();
    await c.locator('#btnPublish').click();
    const published = await steps();
    const queueRow = c.locator('#z5-queue tbody tr').filter({ hasText: 'Q-2607-228' });
    return {
      initial,
      review,
      publishReady,
      published,
      queueState: (await queueRow.locator('td').nth(3).innerText()).trim(),
      queueOperation: (await queueRow.locator('td').nth(5).innerText()).trim(),
      summary: (await c.locator('#z5-make .card > .kv .row').first().innerText()).trim().replace(/\s+/g, ' '),
      publishDisabled: await c.locator('#btnPublish').isDisabled(),
      timelineFirst: (await c.locator('#tlZ5 li').first().innerText()).trim().replace(/\s+/g, ' ')
    };
  }

  async function receiptPersistence() {
    await page.evaluate(() => window.MADEHALL.switchView('b'));
    await page.evaluate(() => window.localStorage.removeItem('madehall.demo.receipt.SO-2011'));
    let b = await reset('B');
    await call(b, 'openOrder', ['SO-2011']);
    const before = {
      button: (await b.locator('#odRcvBtn').textContent()).trim(),
      disabled: await b.locator('#odRcvBtn').isDisabled(),
      markDisplay: await b.locator('#odRcvMark').evaluate(element => getComputedStyle(element).display),
      stepper: await b.locator('[data-od="delivered"] .step').evaluateAll(elements => elements.map(element => element.className))
    };
    await b.locator('#odRcvBtn').dispatchEvent('click');
    const after = {
      button: (await b.locator('#odRcvBtn').textContent()).trim(),
      disabled: await b.locator('#odRcvBtn').isDisabled(),
      markDisplay: await b.locator('#odRcvMark').evaluate(element => getComputedStyle(element).display),
      chipDisplay: await b.locator('#odRcvChip').evaluate(element => getComputedStyle(element).display),
      stepper: await b.locator('[data-od="delivered"] .step').evaluateAll(elements => elements.map(element => element.className))
    };
    await page.reload();
    await page.evaluate(() => window.MADEHALL.switchView('b'));
    b = frame('B');
    await b.locator('body').waitFor({ state: 'attached' });
    for (let i = 0; i < 100; i++) {
      const ready = await b.locator('body').evaluate(body => typeof body.ownerDocument.defaultView.openOrder === 'function');
      if (ready) break;
      await page.waitForTimeout(20);
    }
    await call(b, 'openOrder', ['SO-2011']);
    const afterReload = {
      button: (await b.locator('#odRcvBtn').textContent()).trim(),
      disabled: await b.locator('#odRcvBtn').isDisabled(),
      markDisplay: await b.locator('#odRcvMark').evaluate(element => getComputedStyle(element).display),
      chipDisplay: await b.locator('#odRcvChip').evaluate(element => getComputedStyle(element).display),
      stepper: await b.locator('[data-od="delivered"] .step').evaluateAll(elements => elements.map(element => element.className))
    };
    return { before, after, afterReload };
  }

  return {
    contactLinks: await contactLinks(),
    merchantPass: await auditMerchant('pass'),
    merchantReturn: await auditMerchant('returned'),
    merchantReject: await auditMerchant('rejected'),
    suspendResume: await suspendResume(),
    quotePublish: await quotePublish(),
    receiptPersistence: await receiptPersistence()
  };
}
