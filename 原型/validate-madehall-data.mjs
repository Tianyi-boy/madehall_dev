import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, 'Madehall_unified_prototype_ZH_codex.html');
const html = fs.readFileSync(target, 'utf8');
const ids = ['shared-data', 'embedded-views', 'madehall-entity-data-v2', 'business-chain-repair-v1', 'data-reference-repair-v2'];
const sandbox = { window: {}, console };
vm.createContext(sandbox);

function script(id) {
  const match = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`));
  if (!match) throw new Error(`missing script: ${id}`);
  return match[1];
}

for (const id of ids) vm.runInContext(script(id), sandbox, { timeout: 2000, filename: `${id}.js` });

const data = sandbox.window.MADEHALL_DATA;
const sources = sandbox.window.MH_SOURCES;
const errors = [];
const skuPattern = /^[A-Z]{3}-\d{4}-\d{2}$/;
const oldSkus = ['TC-30', 'CH-20', 'ST-110', 'ST-140', 'ST-180', 'NS-40', 'WS-60', 'DK-90', 'WD-120', 'MT-320', 'MT-400', 'RC-200', 'RC-260', 'RC-320', 'RC-900'];

if (process.argv.includes('--inspect-pdp')) {
  sources.A.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    const inProductCards = lineNo >= 800 && lineNo <= 1050;
    const inPdpLogic = lineNo >= 2220 && lineNo <= 2310;
    if (inProductCards || inPdpLogic || /page-pdp|data-sku|renderPdp|data-product-grid/.test(line)) {
      console.log(`${String(index + 1).padStart(5)}: ${line}`);
    }
  });
  process.exit(0);
}

function check(condition, message) { if (!condition) errors.push(message); }

const productSkus = Object.keys(data.products);
check(productSkus.every((sku) => skuPattern.test(sku)), '产品主数据存在不符合 ABC-nnnn-nn 的 SKU');
check(new Set(productSkus).size === productSkus.length, '产品主数据存在重复 SKU');

const variantSkus = data.semiCustom.map((item) => item.sku);
check(new Set(variantSkus).size === variantSkus.length, '半定制参考变体复用了 SKU');
check(variantSkus.every((sku) => data.products[sku]), '半定制参考变体存在悬空产品 SKU');

const pdpCards = [...sources.A.matchAll(/<div class="pcard"[^>]*data-goto="page-pdp"[^>]*>/g)];
const pdpCardSkus = pdpCards.map((match) => match[0].match(/data-sku="([^"]+)"/)?.[1]);
check(pdpCards.length === 9, `A 产品目录 PDP 卡片数量异常：${pdpCards.length}`);
check(pdpCardSkus.every(Boolean), 'A 存在未携带 data-sku 的 PDP 商品卡');
check(new Set(pdpCardSkus).size === pdpCardSkus.length, 'A 不同 PDP 商品卡复用了同一 SKU');
check(pdpCardSkus.every((sku) => data.products[sku]), 'A PDP 商品卡存在未登记的产品 SKU');
check(sources.A.includes('data-pdp-main') && sources.A.includes('pdpSignedPrice') && sources.A.includes('pdpSpecSize'), 'A PDP 未绑定主图、价格与规格的商品级切换');

for (const pack of data.packages) {
  for (const line of pack.lines) check(Boolean(data.products[line.sku]), `${pack.id} 引用了不存在的产品 ${line.sku}`);
}
check(data.packages.some((pack) => pack.lines.some((line) => variantSkus.includes(line.sku))), 'A 套餐集合未引用任何 B 半定制产品');
for (const line of data.project.lines) check(Boolean(data.products[line.sku]), `${data.project.id} 引用了不存在的产品 ${line.sku}`);
check(JSON.stringify(data.project.lines.map((x) => x.sku)) === JSON.stringify(data.packages[0].lines.map((x) => x.sku)), 'PRJ-1007 产品行未继承 PKG-0001');

const inquiryIds = new Set(data.inquiries.map((row) => row.id));
for (const rfq of data.rfqs) {
  check(Boolean(data.products[rfq.productSku]), `${rfq.id} 引用了不存在的产品 ${rfq.productSku}`);
  check(inquiryIds.has(rfq.id), `询价与报价未覆盖 ${rfq.id}`);
}
check(inquiryIds.has(data.project.quoteId), `询价与报价未覆盖工程项目报价 ${data.project.quoteId}`);
check(data.inquiries.find((x) => x.id === 'QT-1007-01')?.amount === data.project.amount, 'QT-1007-01 与 PRJ-1007 金额不一致');
check(data.inquiries.find((x) => x.id === 'QT-3021-02')?.sourceId === 'RFQ-3021', 'QT-3021-02 未引用 RFQ-3021');
check(sources.B.includes('D.rfqs.map') && sources.C.includes('D.rfqs.map'), 'B/C 未绑定统一 RFQ 实体集合');
check(sources.A.includes('D.packages.forEach') && sources.C.includes('D.packages.map'), 'A/C 未绑定统一套餐实体集合');
check(sources.B.includes('D.inquiries.map') && sources.C.includes('D.inquiries.map'), 'B/C 未绑定统一询价实体集合');

for (const view of ['A', 'B', 'C']) {
  const blocks = [...sources[view].matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  check(blocks.length > 0, `${view} 未发现内联脚本`);
  blocks.forEach((match, index) => {
    try {
      new vm.Script(match[1], { filename: `${view}-inline-${index + 1}.js` });
    } catch (error) {
      errors.push(`${view} 内联脚本 ${index + 1} 语法错误: ${error.stack}`);
    }
  });
}

for (const view of ['A', 'B', 'C']) {
  for (const oldSku of oldSkus) check(!sources[view].includes(oldSku), `${view} 仍含旧 SKU ${oldSku}`);
}

if (errors.length) {
  console.error(`CONSISTENCY CHECK FAILED (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('ALL CONSISTENCY CHECKS PASSED');
  console.log(`products=${productSkus.length} variants=${variantSkus.length} packages=${data.packages.length} rfqs=${data.rfqs.length} inquiries=${data.inquiries.length}`);
  console.log('project=PRJ-1007 quote=QT-1007-01 amount=31900');
}
