async page => {
  const cframe = () => page.locator('#c-frame').contentFrame();

  async function resetC() {
    await page.evaluate(() => {
      const frame = document.getElementById('c-frame');
      frame.srcdoc = window.MH_SOURCES.C;
    });
    const c = cframe();
    await c.locator('#loginView').waitFor({ state: 'visible' });
    const inputs = c.locator('#loginView input');
    await inputs.nth(0).fill('audit');
    await inputs.nth(1).fill('audit');
    await c.locator('#loginView button').filter({ hasText: '登录' }).click();
    await c.locator('#roleSel').selectOption('root（系统管理员）');
    return c;
  }

  async function domSignature(c) {
    return c.locator('body').evaluate(body => {
      const clone = body.cloneNode(true);
      clone.querySelectorAll('script,style,#mergeSharedProof,#toast,.toast,[role="alert"]').forEach(node => node.remove());
      clone.querySelectorAll('[data-toast]').forEach(node => node.removeAttribute('data-toast'));
      return clone.innerHTML.replace(/\s+/g, ' ').trim();
    });
  }

  let c = await resetC();
  const actions = await c.locator('[data-act]').evaluateAll(elements =>
    Array.from(new Set(elements.map(element => element.getAttribute('data-act')))).sort()
  );
  const changed = [];
  const nochange = [];
  const disabled = [];
  const missing = [];

  for (const action of actions) {
    c = await resetC();
    const target = c.locator(`[data-act="${action}"]`).first();
    if (await target.count() === 0) {
      missing.push(action);
      continue;
    }
    const meta = await target.evaluate(element => ({
      text: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' '),
      disabled: Boolean(element.disabled)
    }));
    if (meta.disabled) {
      disabled.push({ action, text: meta.text });
      continue;
    }
    const before = await domSignature(c);
    await target.dispatchEvent('click');
    await page.waitForTimeout(30);
    const after = await domSignature(c);
    const record = { action, text: meta.text };
    (before === after ? nochange : changed).push(record);
  }

  return {
    actionCount: actions.length,
    changedCount: changed.length,
    nochangeCount: nochange.length,
    disabledCount: disabled.length,
    missingCount: missing.length,
    nochange,
    disabled,
    missing
  };
}
