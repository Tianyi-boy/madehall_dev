import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, 'Madehall_unified_prototype_ZH_codex.html');
const html = fs.readFileSync(target, 'utf8');
const ids = ['shared-data', 'embedded-views', 'madehall-entity-data-v2', 'business-chain-repair-v1', 'data-reference-repair-v2', 'consistency-model-v3'];
const sandbox = { window: {}, console };
vm.createContext(sandbox);

function script(id) {
  const match = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)<\\/script>`));
  if (!match) throw new Error(`missing script: ${id}`);
  return match[1];
}

for (const id of ids) vm.runInContext(script(id), sandbox, { timeout: 2000, filename: `${id}.js` });

const data = sandbox.window.MADEHALL_DATA;
const shared = sandbox.window.SHARED;
const sources = sandbox.window.MH_SOURCES;
const errors = [];
const skuPattern = /^[A-Z]{3}-\d{4}-\d{2}$/;
const oldSkus = ['TC-30', 'CH-20', 'ST-110', 'ST-140', 'ST-180', 'NS-40', 'WS-60', 'DK-90', 'WD-120', 'MT-320', 'MT-400', 'RC-200', 'RC-260', 'RC-320', 'RC-900'];
const graphPath = path.join(here, '20-原型数据引用图-v1.0.md');
const graph = fs.readFileSync(graphPath, 'utf8');
const manualName = fs.readdirSync(here).find((name) => name.startsWith('17-') && name.endsWith('.md'));
const manual = manualName ? fs.readFileSync(path.join(here, manualName), 'utf8') : '';

if (process.argv.includes('--inspect-pdp')) {
  sources.A.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    const inProductCards = lineNo >= 730 && lineNo <= 1050;
    const inCatalogLogic = lineNo >= 1750 && lineNo <= 1945;
    const inPdpLogic = lineNo >= 2220 && lineNo <= 2310;
    if (inProductCards || inCatalogLogic || inPdpLogic || /page-pdp|data-sku|renderPdp|data-product-grid|syncPdpCatalog|PDP_CATALOG_PAGE|menuMap/.test(line)) {
      console.log(`${String(index + 1).padStart(5)}: ${line}`);
    }
  });
  process.exit(0);
}
if (process.argv.includes('--inspect-config')) {
  sources.B.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    if ((lineNo >= 370 && lineNo <= 450) || (lineNo >= 1930 && lineNo <= 2225) || /pg-cfg|prefill|URLSearchParams|setCfg|cfgSku|productSku|data-sku|sku=/.test(line)) {
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
check(shared.REF_VARIANTS.length === data.semiCustom.length, 'SHARED 参考变体数量与产品实体层不一致');
check(shared.REF_VARIANTS.every((item, index) => item.sku === data.semiCustom[index].sku), 'SHARED 参考变体顺序或 SKU 与产品实体层不一致');
check(Object.keys(shared.PRODUCTS).every((sku) => data.products[sku] && shared.PRODUCTS[sku].name === `${data.products[sku].name} ${sku}` && JSON.stringify(shared.PRODUCTS[sku].tiers) === JSON.stringify(data.products[sku].tiers)), 'SHARED 白名单产品未从 MADEHALL_DATA 派生');
check(typeof shared.productTiersByName === 'function' && typeof shared.aCatalog === 'function' && typeof shared.clone === 'function', '最终 SHARED 缺少嵌入页兼容所需的派生工具出口');
const sharedTierNames = shared.productTiersByName();
const sharedCatalog = shared.aCatalog();
check(Object.keys(data.products).every((sku) => JSON.stringify(sharedTierNames[data.products[sku].name]) === JSON.stringify(data.products[sku].tiers) && sharedCatalog[sku]?.n === `${data.products[sku].name} ${sku}` && JSON.stringify(sharedCatalog[sku]?.allow) === JSON.stringify(data.products[sku].tiers)), 'SHARED 兼容工具未从 MADEHALL_DATA 实时派生，或再次形成旧产品副本');
check(shared.GLOBALS.MIN_ORDER === 25000 && shared.GLOBALS.DEPOSIT_RATE === 0.3 && shared.GLOBALS.BALANCE_RATE === 0.7 && shared.GLOBALS.STORAGE_DAYS === 14 && shared.GLOBALS.INCOTERM === 'DDP 到门' && shared.GLOBALS.CURRENCY === 'USD', '跨稿全局数值与手册基准不一致');

const residentialSets = Object.values(data.catalogSets.residential);
const contractSets = Object.values(data.catalogSets.contract);
const catalogSkus = residentialSets.flat().concat(contractSets.flat());
const catalogItems = catalogSkus.map((sku) => data.products[sku]);
check(residentialSets.length === 10 && residentialSets.every((set) => set.length === 4), '住宅目录不是 10 个独立品类 × 4 个产品');
check(contractSets.length === 16 && contractSets.every((set) => set.length === 5), '工程目录不是 16 个独立品类 × 5 个产品');
check(catalogItems.length === 120 && new Set(catalogSkus).size === 120, '目录产品 SKU 未做到 120 条完全独立');
check(new Set(catalogItems.map((item) => item.name)).size === catalogItems.length, '跨品类目录产品名称仍存在复用');
check(catalogItems.every((item, index) => item && item.sku === catalogSkus[index] && data.products[item.sku] === item), '目录集合未以 SKU 引用唯一产品主数据');
check(sources.A.includes('D.catalogSets[catalog]') && sources.A.includes('itemSkus.map(function(sku){return P[sku];})') && sources.A.includes("card.setAttribute('data-sku',item.sku)") && sources.A.includes("card.setAttribute('data-cfg',item.cfg)"), 'A 品类切换未完整重绑独立产品实体');

const pdpCards = [...sources.A.matchAll(/<div class="pcard"[^>]*data-goto="page-pdp"[^>]*>/g)];
const pdpCardSkus = pdpCards.map((match) => match[0].match(/data-sku="([^"]+)"/)?.[1]);
check(pdpCards.length === 9, `A 产品目录 PDP 卡片数量异常：${pdpCards.length}`);
check(pdpCardSkus.every(Boolean), 'A 存在未携带 data-sku 的 PDP 商品卡');
check(new Set(pdpCardSkus).size === pdpCardSkus.length, 'A 不同 PDP 商品卡复用了同一 SKU');
check(pdpCardSkus.every((sku) => data.products[sku]), 'A PDP 商品卡存在未登记的产品 SKU');
check(sources.A.includes('data-pdp-main') && sources.A.includes('pdpSignedPrice') && sources.A.includes('pdpSpecSize'), 'A PDP 未绑定主图、价格与规格的商品级切换');
const pdpCatalogs = pdpCardSkus.map((sku) => data.products[sku]?.catalog);
check(pdpCatalogs.slice(0, 4).every((catalog) => catalog === 'residential'), 'A 住宅商品卡未全部归属 residential');
check(pdpCatalogs.slice(4).every((catalog) => catalog === 'contract'), 'A 工程商品卡未全部归属 contract');
check(sources.A.includes('syncPdpCatalog') && sources.A.includes("window.PDP_CATALOG_PAGE||'page-contract'") && sources.A.includes('id="pdpCategory"'), 'A PDP 未按产品目录归属切换导航与面包屑');
const tier2CatalogSkus = catalogSkus.filter((sku) => data.products[sku].tiers.includes('t2'));
check(tier2CatalogSkus.every((sku) => data.products[sku].cfg && data.products[sku].moq), '可配置目录产品缺少 B 预填所需的 cfg 或 moq');
const resolvedTier2Prefills = tier2CatalogSkus.map((sku) => data.configuratorPrefill(sku));
check(resolvedTier2Prefills.every((item, index) => item && item.sku === tier2CatalogSkus[index]), 'Tier2 目录产品无法解析为同 SKU 的配置器预填实体');
const tier2ProductSkus = productSkus.filter((sku) => data.products[sku].tiers.includes('t2'));
const nonTier2CatalogSkus = catalogSkus.filter((sku) => !data.products[sku].tiers.includes('t2'));
const configTypes = new Set(data.semiCustom.map((item) => item.type));
check(tier2ProductSkus.every((sku) => data.semiCustom.some((item) => item.sku === sku)), 'B 半定制参考变体未覆盖全部支持 t2 的产品 SKU');
check(data.semiCustom.length === tier2ProductSkus.length, 'B 半定制参考变体与支持 t2 的产品不是一一对应');
check(tier2ProductSkus.every((sku) => {
  const product = data.products[sku];
  const variant = data.semiCustom.find((item) => item.sku === sku);
  return variant && product.referenceVariant?.sku === sku && product.cfg === [variant.size, variant.color, variant.shape, variant.addon].join(' · ') && product.price === variant.price && product.moq === Number.parseInt(variant.moq, 10) && product.tierFacts?.t2?.unitPrice === variant.price && product.tierFacts.t2.channel === 'formal_quote';
}), 'Tier2 产品主数据与参考变体存在双事实源漂移');
check(nonTier2CatalogSkus.length > 0, '目录数据未保留不支持半定制的产品');
const sofaPrefill = data.configuratorPrefill('SOF-1001-01');
check(sofaPrefill?.sku === 'SOF-1001-01' && sofaPrefill?.typeName === '沙发' && sofaPrefill?.size === '3 座' && sofaPrefill?.price === 1180 && sofaPrefill?.moq === '6 件', 'SOF-1001-01 配置器解析结果与 PDP 产品数据不一致');
check(data.configuratorPrefill('SOF-1002-01') === null, '不支持半定制的 SOF-1002-01 被错误解析为配置器产品');
check(sources.A.includes("#pg-cfg-prefill") && sources.A.includes("encodeURIComponent(sku)"), 'A PDP 未把当前 SKU 传入 B 配置器路由');
check(html.includes("if(hash==='pg-cfg-prefill')") && html.includes("w.setCfgVariant('a')") && html.includes("w.prefillConfigFromSku(cfgSku)"), '统一路由未重置为产品页入口并把 PDP SKU 调用到 B 配置器预填函数');
check(sources.A.includes('allow:p.tiers.slice()') && !sources.A.includes('var semiCustomSku={}'), 'A PDP 原有可售档位显隐机制未恢复');
check(sources.B.includes('id="cfgTypeSelect"') && sources.B.includes('id="cfgSkuSelect"') && sources.B.includes('TYPE_ORDER.forEach') && sources.B.includes('renderSkuSelect(type)') && sources.B.includes('D.configuratorPrefill(rawSku)'), 'B 配置器未使用完整参考变体数据生成产品类型与 SKU 联动下拉框');
check(sources.B.includes("link.setAttribute('data-original-href',target)") && sources.B.includes("var target='Fabbrio_storefront_ZH_target.html?sku='"), 'B 所选 SKU 未同步写入跨视角链接的 data-original-href');
check(sources.A.includes('window.applyPdpSku=function(rawSku)') && sources.A.includes("var sku=rawSku||new URLSearchParams(location.search).get('sku'),p=P[sku]") && sources.A.includes("document.getElementById('pdpTitle').textContent=p.name"), 'A 返回链路未直接使用统一路由传入 SKU 重建对应 PDP');
check(data.products['SOF-1001-01']?.cfg === '3 座 · 浅灰绒布 · 金属直脚 · 标准配置' && data.products['SOF-1001-01']?.moq === 6, 'SOF-1001-01 的配置器预填数据与 PDP 不一致');

for (const pack of data.packages) {
  for (const line of pack.lines) check(Boolean(data.products[line.sku]), `${pack.id} 引用了不存在的产品 ${line.sku}`);
}
const expectedVerticals = ['hotel', 'multifamily', 'student', 'senior', 'office', 'restaurant', 'model'];
check(data.packages.length === 7, '套餐数量不是 7 个业态各 1 个');
check(new Set(data.packages.map((pack) => pack.verticalKey)).size === 7 && expectedVerticals.every((key) => data.packages.some((pack) => pack.verticalKey === key)), '套餐业态映射不完整或重复');
check(data.packages.every((pack) => pack.lines.length > 0), '存在空套餐，未形成独立套餐行项');
check(data.packages.every((pack) => Array.isArray(pack.certs) && pack.certs.length > 0), '存在未配置业态认证信息的套餐');
check(sources.A.includes('window.renderVerticalPackage') && sources.A.includes("style.display=card.getAttribute('data-v')===verticalKey?'':'none'") && sources.C.includes('D.packages.map'), 'A 未做到每业态仅显示 1 个套餐，或 C 未绑定同一套餐集合');
check(sources.C.includes('data-package-preview') && sources.C.includes('renderPackagePreview'), 'C 套包预览未按套餐 ID 读取对应行项');
check(data.packages.some((pack) => pack.lines.some((line) => variantSkus.includes(line.sku))), 'A 套餐集合未引用任何 B 半定制产品');
for (const line of data.project.lines) check(Boolean(data.products[line.sku]), `${data.project.id} 引用了不存在的产品 ${line.sku}`);
const projectPackage = data.packages.find((pack) => pack.id === data.project.packageId);
check(Boolean(projectPackage), `${data.project.id} 引用了不存在的套餐 ${data.project.packageId}`);
check(JSON.stringify(data.project.lines) === JSON.stringify(projectPackage?.lines), 'PRJ-1007 行项快照未完整继承其 packageId 对应套餐');
check(data.project.lines !== projectPackage?.lines, 'PRJ-1007 行项与来源套餐复用了同一数组，非独立快照');
check(data.project.charges !== data.quotes.find((quote) => quote.id === data.project.quoteId)?.charges, 'PRJ-1007 与正式报价复用了费用数组，非独立快照');
const calculatedProjectLineAmount = data.project.lines.reduce((total, line) => total + line.qty * line.wp, 0);
const calculatedProjectCharges = data.project.charges.reduce((total, charge) => total + charge.amount, 0);
check(data.project.lineAmount === calculatedProjectLineAmount, `PRJ-1007 产品行小计不一致：声明 ${data.project.lineAmount}，计算 ${calculatedProjectLineAmount}`);
check(data.project.amount === calculatedProjectLineAmount + calculatedProjectCharges, `PRJ-1007 总额不等于产品行小计＋费用：${calculatedProjectLineAmount}+${calculatedProjectCharges}!=${data.project.amount}`);
check(data.project.charges.every((charge) => charge.code && charge.label && Number.isFinite(charge.amount)), 'PRJ-1007 存在不可勾稽的附加费用');

const workItemIds = new Set(data.workItems.map((row) => row.id));
check(workItemIds.size === data.workItems.length, '统一工作清单存在重复 ID');
for (const row of data.workItems) {
  if (row.productSku) check(Boolean(data.products[row.productSku]), `工作清单 ${row.id} 引用了不存在的产品 ${row.productSku}`);
  if (row.sourceType === 'project') check(row.sourceId === data.project.id, `工作清单 ${row.id} 引用了不存在的项目 ${row.sourceId}`);
  if (row.sourceType === 'rfq' && row.sourceId) check(data.rfqs.some((rfq) => rfq.id === row.sourceId), `工作清单 ${row.id} 引用了不存在的 RFQ ${row.sourceId}`);
  if (row.sourceType === 'semi' && row.sourceId) check(data.workItems.some((item) => item.id === row.sourceId), `工作清单 ${row.id} 引用了不存在的 Tier2 询价 ${row.sourceId}`);
}
for (const rfq of data.rfqs) {
  check(Boolean(data.products[rfq.productSku]), `${rfq.id} 引用了不存在的产品 ${rfq.productSku}`);
  check(workItemIds.has(rfq.id), `询价与报价工作清单未覆盖 ${rfq.id}`);
}
check(workItemIds.has(data.project.quoteId), `询价与报价工作清单未覆盖工程项目报价 ${data.project.quoteId}`);
check(data.inquiries === data.workItems, '旧 inquiries 兼容别名未指向统一 workItems 集合');
check(new Set(data.quotes.map((quote) => quote.id)).size === data.quotes.length, '正式报价单存在重复 ID');
for (const quote of data.quotes) {
  const source = quote.sourceType === 'project'
    ? (data.project.id === quote.sourceId ? data.project : null)
    : quote.sourceType === 'semi'
      ? data.workItems.find((item) => item.id === quote.sourceId)
      : data.rfqs.find((rfq) => rfq.id === quote.sourceId);
  check(Boolean(source), `${quote.id} 引用了不存在的来源 ${quote.sourceId}`);
  check(workItemIds.has(quote.id), `统一工作清单未覆盖正式报价 ${quote.id}`);
  check(source?.quoteId === quote.id, `${quote.id} 与来源 ${quote.sourceId} 未形成双向引用`);
  check(quote.amount === quote.lineAmount + quote.charges.reduce((total, charge) => total + charge.amount, 0), `${quote.id} 总额不等于行小计＋费用`);
  const workItem = data.workItems.find((row) => row.id === quote.id);
  check(workItem?.sourceType === quote.sourceType && workItem?.sourceId === quote.sourceId && workItem?.status === quote.status && workItem?.amount === quote.amount, `工作清单 ${quote.id} 与正式报价实体不一致`);
}
const projectQuote = data.quotes.find((quote) => quote.id === 'QT-1007-01');
const rfqQuote = data.quotes.find((quote) => quote.id === 'QT-3021-02');
check(projectQuote?.amount === data.project.amount && projectQuote?.lineAmount === data.project.lineAmount, 'QT-1007-01 与 PRJ-1007 金额结构不一致');
check(rfqQuote?.sourceId === 'RFQ-3021', 'QT-3021-02 未引用 RFQ-3021');
const tier2Quote = data.quotes.find((quote) => quote.id === 'QT-0611-01');
check(tier2Quote?.sourceType === 'semi' && tier2Quote?.sourceId === 'Q-T2-0611' && tier2Quote?.amount === 6144, 'Q-T2-0611 未形成同源正式报价 QT-0611-01');
check(data.workItems.filter((item) => item.sourceType === 'semi' && item.status === '已接受').every((item) => item.quoteId && data.quotes.some((quote) => quote.id === item.quoteId)), '已接受 Tier2 询价缺少正式 Quote');
for (const entity of [data.project, ...data.rfqs]) {
  check(shared.DOCS[entity.id]?.status === entity.status, `SHARED.DOCS ${entity.id} 状态与业务实体不一致`);
}
for (const quote of data.quotes) {
  check(shared.DOCS[quote.id]?.status === quote.status && shared.DOCS[quote.id]?.amount === quote.amount, `SHARED.DOCS ${quote.id} 状态或金额与正式报价实体不一致`);
}
const expectedDocIds = new Set([
  ...data.merchantApplications.map((item) => item.applicationNo),
  ...data.workItems.filter((item) => item.id.startsWith('Q-T2-')).map((item) => item.id),
  ...data.rfqs.map((item) => item.id),
  data.project.id,
  ...data.quotes.map((item) => item.id),
  ...data.orders.map((item) => item.id),
  ...data.collections.map((item) => item.id),
  ...data.shopifyOrders.map((item) => item.id),
]);
check(Object.keys(shared.DOCS).length === expectedDocIds.size && Object.keys(shared.DOCS).every((id) => expectedDocIds.has(id)), 'SHARED.DOCS 残留旧展示单据或缺少当前业务实体镜像');
check(!shared.DOCS['SO-2024'], 'SHARED.DOCS 残留旧的 SO-2024 展示单据');
check(sources.B.includes('D.rfqs.map') && sources.C.includes('D.rfqs.map'), 'B/C 未绑定统一 RFQ 实体集合');
check(sources.A.includes('D.packages.forEach') && sources.C.includes('D.packages.map'), 'A/C 未绑定统一套餐实体集合');
check(sources.B.includes('D.workItems.map') && sources.C.includes('D.workItems.map'), 'B/C 未绑定统一工作清单实体集合');
check(sources.B.includes("item.id===D.project.packageId") && !sources.B.includes("D.packages[0].name+'」 · 行项全部引用"), 'B 工程项目来源套餐仍按数组首项取值，未按 packageId 解引用');
check(sources.C.includes('D.project.lineAmount') && sources.C.includes('D.project.charges.map') && sources.C.includes('D.project.amount'), 'C 报价工作面未展示项目行小计、费用与整单总额的同源结构');
check(sources.A.includes('parent.MADEHALL.registerBasket') && sources.A.includes('productSku:row.sku'), 'A 自组项目未把 SKU 行快照传给统一路由');
check(sources.A.includes('tier:row.tier') && sources.B.includes('window.applyCustomBasket') && sources.B.includes('data-basket-line') && sources.B.includes("title.textContent='新建 FF&E 自选项目 · '+snapshot.id") && sources.B.includes("crumb.textContent='工程项目 › 自选组合 · '+snapshot.id") && sources.B.includes('fixedEl.textContent=money(fixed)') && sources.B.includes('refEl.textContent=money(reference)'), 'A→B 自选项目未保留档位快照，或 B 仍显示固定项目标题/金额');
check(html.includes("if(w.setFfeView)w.setFfeView('draft');if(src==='custom'&&w.applyCustomBasket)w.applyCustomBasket"), 'B 自选项目快照在草稿视图渲染前被应用，后续渲染会覆盖标题与金额');
check(sources.B.includes('D.orders') && sources.C.includes('D.orders'), 'B/C 订单视图未绑定统一 Order 实体');
check(sources.C.includes('financeEntityProof') && sources.C.includes('收款实体只读勾稽（SC → SO → Quote）') && sources.C.includes('D.collections.map'), 'C 财务只读视图仍未从统一 SC/SO/Quote 实体重建');
check(sources.C.includes('D.auditLog') && sources.C.includes('entityAuditProof'), 'C 未展示结构化 AuditLog 切片');
check(sources.A.includes('merchantEntityProof') && sources.A.includes('merchantStateMapA') && sources.A.includes('D.merchantStateMachine') && sources.C.includes('data-application-no') && sources.C.includes('D.merchantApplications'), 'A/C 商户视图未按 applicationNo 或统一状态机绑定申请实体');
check(sources.C.includes('window.applyRole=function') && sources.C.includes('allowed.indexOf(active.id)'), 'C 角色切换未强制落到当前角色的授权区');
check(['A', 'B', 'C'].every((view) => sources[view].includes("['SO-1007','Q-T2-0611','PRJ-1007']") && !sources[view].includes("['SO-2024','Q-T2-0611','PRJ-1007']")), '跨稿公共读回卡仍引用旧订单 SO-2024');

check(sources.C.includes('D.merchantStateMachine') && sources.C.includes('merchantStateMap'), 'C 未展示统一商户七态到对客五档映射');
const requiredStatusKeys = ['submitted', 'in_design', 'design_review', 'pricing', 'quoted', 'deposit_pending', 'deposit_paid', 'in_production', 'delivered', 'closed', 'rejected', 'cancelled', 'on_hold', 'expired'];
check(JSON.stringify(Object.keys(shared.STATUS_PUBLIC).sort()) === JSON.stringify(requiredStatusKeys.slice().sort()), 'SHARED 对客状态表不是 v4.10 的 14 态全集');
check(!Object.prototype.hasOwnProperty.call(shared.STATUS_PUBLIC, 'rework'), 'SHARED 对客状态表残留非契约状态 rework');
check(Object.isFrozen(data) && Object.isFrozen(data.project.lines) && Object.isFrozen(data.project.charges), '实体模型未深冻结，运行时仍可能发生快照漂移');
check(Array.isArray(data.orders) && data.orders.length >= 3 && data.orders.every((order) => data.quotes.some((quote) => quote.id === order.sourceQuoteId) && order.amount === data.quotes.find((quote) => quote.id === order.sourceQuoteId).amount), 'SO 订单未与正式 Quote 建立同号同额引用');
check(data.workItems.filter((item) => item.id.startsWith('Q-T2-')).every((item) => /^Q-T2-\d+$/.test(item.id)) && data.rfqs.every((item) => /^RFQ-\d+$/.test(item.id)) && /^PRJ-\d+$/.test(data.project.id) && data.quotes.every((item) => /^QT-\d+-\d+$/.test(item.id)) && data.orders.every((item) => /^SO-\d+$/.test(item.id)) && data.collections.every((item) => /^SC-\d+-\d+$/.test(item.id)) && data.packages.every((item) => /^PKG-\d+$/.test(item.id)), '业务单号前缀 Q-T2/RFQ/PRJ/QT/SO/SC/PKG 存在不符合路由契约的实体');
check(Array.isArray(data.collections) && data.collections.every((collection) => data.orders.some((order) => order.id === collection.orderId)), 'SC 收款未关联统一 SO 订单');
check(data.orders.every((order) => data.collections.filter((collection) => collection.orderId === order.id).reduce((sum, collection) => sum + collection.amount, 0) === order.amount), 'SC 首期/尾款合计与对应 SO 金额不一致');
check(Array.isArray(data.shopifyOrders) && data.shopifyOrders.every((order) => /^PO-/.test(order.id)), 'Shopify 边界订单未使用 PO 前缀');
check(data.shopifyOrders.every((order) => data.products[order.productSku]?.tiers.includes('t1') && order.tier === 't1' && data.products[order.productSku].tierFacts?.t1?.channel === 'shopify' && data.products[order.productSku].tierFacts.t1.unitPrice === order.unitPrice && order.amount === order.qty * order.unitPrice), 'Tier1 Shopify PO 未以产品 t1 事实源勾稽 SKU、单价与金额');
check(Array.isArray(data.designRounds) && Array.isArray(data.assets) && data.rfqs.every((rfq) => Array.isArray(rfq.designRoundIds) && rfq.designRoundIds.every((id) => data.designRounds.some((round) => round.id === id && round.rfqId === rfq.id))), 'Tier3 RFQ 与设计轮次未形成引用链');
check(data.assets.filter((asset) => asset.deliveryOrderId).every((asset) => data.orders.some((order) => order.id === asset.deliveryOrderId)), '交付资产未关联销售订单');
check(Array.isArray(data.merchantApplications) && Array.isArray(data.companies) && data.merchantApplications.filter((application) => application.companyGid).every((application) => data.companies.some((company) => company.applicationNo === application.applicationNo && company.companyGid === application.companyGid)), '商户申请与 Company GID 未形成同一对象引用');
const merchantStates = ['submitted', 'provisioning', 'provision_failed', 'need_info', 'rejected', 'active', 'suspended'];
const merchantPublicStages = { submitted: '审核中', provisioning: '审核中', provision_failed: '审核中', need_info: '请补充材料', rejected: '未通过（可重新申请）', active: '正常使用', suspended: '账户已停用，请联系客服' };
check(JSON.stringify(data.merchantStateMachine?.internalStates) === JSON.stringify(merchantStates), '商户准入七态未按手册定义建模');
check(JSON.stringify(data.merchantStateMachine?.publicStageByInternal) === JSON.stringify(merchantPublicStages), '商户准入七态到对客五档的映射不符合手册');
check(data.merchantApplications.every((application) => data.merchantStateMachine?.internalStates.includes(application.status) && application.publicStage === data.merchantStateMachine.publicStageByInternal[application.status]), '商户申请状态或对客档位未从统一七态映射派生');
check(['supplement_resubmitted', 'rejected', 'suspended', 'restored'].every((action) => data.auditLog.some((event) => event.objectType === 'merchant' && event.action === action && data.merchantApplications.some((application) => application.applicationNo === event.objectId))), '补件、拒绝、停用或恢复未以同一 applicationNo 写入 AuditLog');
const restoredApplications = new Set(data.auditLog.filter((event) => event.objectType === 'merchant' && event.action === 'restored').map((event) => event.objectId));
check([...restoredApplications].every((applicationNo) => data.auditLog.some((event) => event.objectType === 'merchant' && event.objectId === applicationNo && event.action === 'suspended')), '商户停用与恢复未在同一 applicationNo 形成审计闭环');
const merchantAudit = data.auditLog.filter((event) => event.objectType === 'merchant');
check(merchantAudit.every((event) => Array.isArray(data.merchantStateMachine.transitions[event.action]) && data.merchantStateMachine.transitions[event.action][0] === event.before && data.merchantStateMachine.transitions[event.action][1] === event.after), '商户 AuditLog 存在未定义转换或 before/after 与状态机不一致');
check(data.merchantApplications.every((application) => { const events = merchantAudit.filter((event) => event.objectId === application.applicationNo).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)); return events.length === 0 ? application.status === 'submitted' : events.at(-1).after === application.status; }), '商户当前状态未与同一 applicationNo 的最后一条 AuditLog after 对齐');
const auditObjectTypes = new Set(data.auditLog.map((event) => event.objectType));
check(['merchant', 'rfq', 'quote', 'order', 'account'].every((type) => auditObjectTypes.has(type)), 'AuditLog 未覆盖商户/RFQ/Quote/Order/账号五类切片');
check(data.auditLog.every((event) => event.eventId && event.occurredAt && event.actorId && event.objectType && event.objectId && event.reason), 'AuditLog 缺少可勾稽字段');
const auditResolvers = {
  merchant: (id) => data.merchantApplications.some((item) => item.applicationNo === id),
  rfq: (id) => data.rfqs.some((item) => item.id === id),
  quote: (id) => data.quotes.some((item) => item.id === id),
  order: (id) => data.orders.some((item) => item.id === id),
  account: (id) => data.accounts.some((item) => item.id === id),
  collection: (id) => data.collections.some((item) => item.id === id),
};
check(data.auditLog.every((event) => auditResolvers[event.objectType]?.(event.objectId)), 'AuditLog 存在无法解析的 objectType/objectId');
check(data.supportExceptions.every((item) => item.sourceId && item.reason && item.actorId), '客服与人工例外缺少来源 ID、理由或操作者');
const exceptionTypes = ['补件代传', '代改 BOM', '意见代录', '补收', '物流手录', '变更报价'];
const exceptionObjectIds = new Set([
  ...data.merchantApplications.map((item) => item.applicationNo), ...data.rfqs.map((item) => item.id), ...data.quotes.map((item) => item.id), ...data.orders.map((item) => item.id), ...data.collections.map((item) => item.id),
]);
check(exceptionTypes.every((type) => data.supportExceptions.some((item) => item.type === type)), '客服与人工例外未覆盖补件代传、代改 BOM、意见代录、补收、物流手录和变更报价');
check(data.supportExceptions.every((item) => exceptionObjectIds.has(item.sourceId)), '客服与人工例外存在无法解析的来源 ID');
check(data.masterData.costVersions.every((item) => item.checkerId) && data.masterData.exchangeRates.every((item) => item.checkerId) && data.masterData.factories.every((item) => item.id), '主数据治理缺少四眼或 Factory 锚点');
const expectedRoleZones = {'客服专员':['z1','z2','z6'],'商务运营':['z2','z4','z5','z6','z9'],'产品设计工程师':['z3'],'项目经理':['z5','z7'],'报价与供应链协调员':['z5','z6'],'财务只读':['z8'],'root（系统管理员）':['z1','z2','z3','z4','z5','z6','z7','z8','z9','zsys']};
check(JSON.stringify(data.rolePolicy?.zones) === JSON.stringify(expectedRoleZones) && data.rolePolicy.rootRole === 'root（系统管理员）' && data.rolePolicy.financeReadOnlyRole === '财务只读' && data.rolePolicy.makerChecker?.rootMustDifferFromMaker && data.rolePolicy.makerChecker.attribute === 'data-eyes', '角色→区域、root、财务只读或 maker/checker 约束未在统一事实源建模');
check(sources.C.includes('ROLE_ZONES=JSON.parse(JSON.stringify(rolePolicy.zones))') && sources.C.includes("ROOT=rolePolicy.rootRole") && sources.C.includes('renderNav();window.applyRole();') && sources.C.includes('data-eyes'), 'C 页面未从统一角色策略重建区域权限、首帧刷新或保留四眼约束');

for (let chain = 1; chain <= 12; chain += 1) {
  check(new RegExp(`^## ${chain}\\. `, 'm').test(graph), `数据引用图缺少大路径 ${chain} 的独立章节`);
}
check(graph.includes('v4.9＋v4.10 停用口径') && graph.includes('workItems') && graph.includes('quotes') && graph.includes('AuditLog'), '数据引用图缺少版本优先级或关键实体分层');
check(graph.includes('orders') && graph.includes('merchantApplications') && graph.includes('designRounds') && graph.includes('v1.2'), '数据引用图未记录统一订单、商户、设计资产或 v1.2 修复口径');
check(manual.includes('实际版本 **v4.10**') && manual.includes('本手册 v1.4') && manual.includes('RCP-0200-01＝T1·T2'), '业务路径手册未升级到 v4.10 / v1.4 的当前口径');
check(!/\b(?:TC-30|CH-20|ST-110|ST-140|ST-180|NS-40|WS-60|DK-90|WD-120|MT-320|MT-400|RC-200|RC-260|RC-320|RC-900)\b/.test(manual), '业务路径手册仍使用已停用的旧 SKU');

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
  check(new RegExp(`<script data-consistency-model="${view}">[\\s\\S]*?<\\/script>\\s*<\\/body>`).test(sources[view]), `${view} 的一致性注入脚本未正确闭合`);
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
  console.log(`products=${productSkus.length} catalogProducts=${catalogItems.length} residentialCategories=${residentialSets.length} contractCategories=${contractSets.length}`);
  console.log(`variants=${variantSkus.length} packages=${data.packages.length} packageVerticals=${new Set(data.packages.map((pack) => pack.verticalKey)).size} rfqs=${data.rfqs.length} workItems=${data.workItems.length} quotes=${data.quotes.length}`);
  console.log(`pdpCards=${pdpCards.length} uniquePdpSkus=${new Set(pdpCardSkus).size} residential=4 contract=5 tier2CatalogProducts=${tier2CatalogSkus.length} nonTier2CatalogProducts=${nonTier2CatalogSkus.length} configTypes=${configTypes.size}`);
  console.log(`project=PRJ-1007 lines=${data.project.lineAmount} charges=${calculatedProjectCharges} quote=QT-1007-01 amount=${data.project.amount}`);
  console.log(`orders=${data.orders.length} collections=${data.collections.length} shopifyOrders=${data.shopifyOrders.length} merchantApplications=${data.merchantApplications.length} auditEvents=${data.auditLog.length} designRounds=${data.designRounds.length} assets=${data.assets.length}`);
}
