async page => {
  const outer = await page.evaluate(() => ({
    current: Array.from(document.querySelectorAll('.uview.on')).map(element => element.id),
    bClass: document.getElementById('b-frame').className,
    loaded: Object.keys(window.MADEHALL.loaded)
  }));
  const b = page.locator('#b-frame').contentFrame();
  const inner = await b.locator('body').evaluate(body => {
    const doc = body.ownerDocument;
    const win = doc.defaultView;
    const button = Array.from(doc.querySelectorAll('button')).find(element => element.textContent.trim() === '11 订单');
    return {
      title: doc.title,
      ready: doc.readyState,
      showPage: typeof win.showPage,
      openOrdersList: typeof win.openOrdersList,
      buttonCode: button && button.getAttribute('data-onclick'),
      buttonVisible: button && getComputedStyle(button).display !== 'none',
      onPages: Array.from(doc.querySelectorAll('.page.on')).map(element => element.id),
      ordersClass: doc.getElementById('pg-orders').className,
      listStyle: doc.querySelector('[data-od="list"]').style.display
    };
  });
  return { outer, inner };
}
