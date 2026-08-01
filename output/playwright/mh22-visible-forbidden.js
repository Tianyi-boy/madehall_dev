async page => {
  const forbidden = [
    ['小改免费', /小改免费/g],
    ['以本品为参考发起 RFQ', /以本品为参考发起\s*RFQ/g],
    ['即时报价', /即时报价/g],
    ['即时成交', /即时成交/g],
    ['EUR', /\bEUR\b/g],
    ['€', /€/g],
    ['AI 拆单', /AI\s*拆单/gi],
    ['AI brief', /AI\s*brief/gi],
    ['智能匹配', /智能匹配/g],
    ['LLM', /\bLLM\b/gi]
  ];
  const result = {};
  for (const key of ['a', 'b', 'c']) {
    await page.evaluate(key => window.MADEHALL.switchView(key), key);
    const frame = page.locator('#' + key + '-frame').contentFrame();
    await frame.locator('body').waitFor({ state: 'attached' });
    const bodyText = await frame.locator('body').innerText();
    result[key.toUpperCase()] = forbidden.flatMap(([name, pattern]) => {
      const matches = bodyText.match(pattern) || [];
      return matches.length ? [{ name, count: matches.length }] : [];
    });
  }
  return result;
}
