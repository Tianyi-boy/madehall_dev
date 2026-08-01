async page => {
  await page.reload();
  for (const key of ['b', 'c', 'a']) {
    await page.evaluate(key => window.MADEHALL.switchView(key), key);
    await page.waitForTimeout(180);
  }
  const shared = await page.evaluate(() => ({
    products: Object.keys(window.SHARED.PRODUCTS),
    globals: window.SHARED.GLOBALS,
    docs: ['SO-2024', 'Q-T2-0611', 'PRJ-1007'].map(no => ({ no, amount: window.SHARED.DOCS[no].amount, status: window.SHARED.DOCS[no].status })),
    repairScript: Boolean(document.getElementById('business-chain-repair-v1'))
  }));
  const frames = [];
  for (const frame of page.frames()) {
    const title = await frame.title().catch(() => '');
    if (!title || title.includes('统一原型 ZH')) continue;
    const facts = await frame.locator('html').evaluate(html => {
      const doc = html.ownerDocument;
      const counts = {};
      doc.querySelectorAll('[id]').forEach(element => counts[element.id] = (counts[element.id] || 0) + 1);
      return {
        duplicateIds: Object.keys(counts).filter(id => counts[id] > 1),
        onclick: doc.querySelectorAll('[onclick]').length,
        sharesParent: doc.defaultView.SHARED === doc.defaultView.parent.SHARED,
        enabledButtons: Array.from(doc.querySelectorAll('button')).filter(button => !button.disabled).length,
        totalButtons: doc.querySelectorAll('button').length,
        contactRepairLinks: doc.querySelectorAll('#page-merchant .lead a[data-goto="page-contact"],#ssv4 .stbanner a[data-goto="page-contact"]').length
      };
    });
    frames.push({ title, ...facts });
  }
  await page.evaluate(() => window.localStorage.removeItem('madehall.demo.receipt.SO-2011'));
  return { shared, frames };
}
