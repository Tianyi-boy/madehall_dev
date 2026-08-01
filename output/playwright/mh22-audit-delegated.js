async page => {
  async function reset(key) {
    const id = key.toLowerCase() + '-frame';
    await page.evaluate(({ id, key }) => {
      const frame = document.getElementById(id);
      frame.srcdoc = window.MH_SOURCES[key];
    }, { id, key });
    const frame = page.locator('#' + id).contentFrame();
    await frame.locator('body').waitFor({ state: 'attached' });
    return frame;
  }

  async function signature(frame) {
    return frame.locator('body').evaluate(body => {
      const clone = body.cloneNode(true);
      clone.querySelectorAll('script,style,#mergeSharedProof,#toast,.toast,[role="alert"]').forEach(node => node.remove());
      return clone.innerHTML.replace(/\s+/g, ' ').trim();
    });
  }

  async function audit(key) {
    let frame = await reset(key);
    const raw = await frame.locator('[data-onclick]').evaluateAll(elements => elements.map((element, index) => ({
      index,
      code: element.getAttribute('data-onclick'),
      text: (element.innerText || element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90)
    })));
    const seen = new Set();
    const entries = raw.filter(item => item.code && !seen.has(item.code) && seen.add(item.code));
    const changed = [];
    const nochange = [];
    const disabled = [];
    for (const entry of entries) {
      frame = await reset(key);
      const target = frame.locator('[data-onclick]').nth(entry.index);
      if (await target.evaluate(element => Boolean(element.disabled))) {
        disabled.push(entry);
        continue;
      }
      const before = await signature(frame);
      await target.dispatchEvent('click');
      await page.waitForTimeout(30);
      const after = await signature(frame);
      (before === after ? nochange : changed).push(entry);
    }
    return {
      key,
      uniqueCount: entries.length,
      changedCount: changed.length,
      nochangeCount: nochange.length,
      disabledCount: disabled.length,
      nochange,
      disabled
    };
  }

  return [await audit('A'), await audit('B')];
}
