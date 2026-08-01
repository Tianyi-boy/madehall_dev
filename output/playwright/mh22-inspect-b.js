async page => {
  await page.reload();
  await page.evaluate(() => window.MADEHALL.switchView('b'));
  await page.waitForTimeout(500);
  const sourceFacts = await page.evaluate(() => {
    const source = window.MH_SOURCES.B;
    return {
      length: source.length,
      hasOpenOrder: source.includes('function openOrder(no)'),
      hasReceiptKey: source.includes("RECEIPT_KEY='madehall.demo.receipt.SO-2011'"),
      hasReceiptInit: source.includes("setQtState('quoted'); applyReceiptMark();")
    };
  });
  const b = page.locator('#b-frame').contentFrame();
  await b.locator('#pg-orders').waitFor({ state: 'attached' });
  const runtime = await b.locator('body').evaluate(body => {
    const win = body.ownerDocument.defaultView;
    return {
      title: body.ownerDocument.title,
      scripts: body.ownerDocument.scripts.length,
      openOrder: typeof win.openOrder,
      showPage: typeof win.showPage,
      setT2q: typeof win.setT2q,
      confirmReceipt: typeof win.confirmReceipt,
      applyReceiptMark: typeof win.applyReceiptMark,
      hasOrdersDom: Boolean(body.ownerDocument.getElementById('pg-orders')),
      textStart: body.innerText.slice(0, 100)
    };
  });
  return { sourceFacts, runtime };
}
