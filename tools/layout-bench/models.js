const $=id=>document.getElementById(id);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function parseTtl(text){
  const classes=new Map(), edges=[], props=new Map();
  const blocks=[]; let cur=null;
  text.split(/\r?\n/).forEach(l=>{ if(/^[^\s@#"]/.test(l)&&!/^\./.test(l)){cur=[l];blocks.push(cur);} else if(cur)cur.push(l); });
  const loc=s=>s.replace(/^\S*?:/,'').replace(/[<>]/g,'');
  blocks.forEach(b=>{
    const t=b.join('\n'), subj=b[0].split(/\s+/)[0];
    if(/\sa\s+owl:Class/.test(b[0])){ classes.set(subj,loc(subj)); const m=t.match(/rdfs:subClassOf\s+(\S+)/); if(m) edges.push({s:subj,t:m[1].replace(/[;.,]$/,''),kind:'sub'}); }
    else if(/\sa\s+owl:ObjectProperty/.test(b[0])){ const d=t.match(/(?:domainIncludes|rdfs:domain)\s+(\S+)/), r=t.match(/(?:rangeIncludes|rdfs:range)\s+(\S+)/);
      if(d&&r) edges.push({s:d[1].replace(/[;.,]$/,''),t:r[1].replace(/[;.,]$/,''),kind:'prop'}); }
  });
  return {classes,edges};
}
async function loadTtls(paths){
  const all={classes:new Map(),edges:[]};
  for(const p of paths){ const r=parseTtl(await (await fetch(p)).text()); r.classes.forEach((v,k)=>all.classes.set(k,v)); all.edges.push(...r.edges); }
  const names=[...all.classes.keys()]; const idx=new Map(names.map((n,i)=>[n,i]));
  all.edges.forEach(e=>{ for(const k of ['s','t']) if(!idx.has(e[k])){ idx.set(e[k],names.length); names.push(e[k]); all.classes.set(e[k],e[k].replace(/^\S*?:/,'')); } });
  return {labels:names.map(n=>all.classes.get(n)), edges:all.edges.map(e=>({s:idx.get(e.s),t:idx.get(e.t),kind:e.kind}))};
}
function bigModel(){
  const D={
   Party:{Person:['Customer','Employee','Beneficiary','Guarantor','Director'],LegalEntity:['Corporation','Partnership','Trust','Subsidiary','Bank'],Government:['Regulator','CentralBank','Municipality','TaxAuthority']},
   Account:{DepositAccount:['CheckingAccount','SavingsAccount','MoneyMarketAccount','CertificateOfDeposit'],CreditAccount:['CreditCardAccount','LineOfCredit','MortgageAccount','AutoLoanAccount'],InvestmentAccount:['BrokerageAccount','RetirementAccount','CustodyAccount','MarginAccount']},
   Instrument:{Equity:['CommonStock','PreferredStock','DepositaryReceipt','Warrant'],DebtInstrument:['Bond','PromissoryNote','Debenture','TreasuryBill','CommercialPaper'],Derivative:['OptionContract','FutureContract','SwapContract','ForwardContract'],FundShare:['ETFShare','MutualFundShare','HedgeFundInterest']},
   Transaction:{Payment:['WireTransfer','ACHPayment','CardPayment','CheckPayment'],Trade:['EquityTrade','BondTrade','FXTrade','DerivativeTrade'],Settlement:['ClearingInstruction','DeliveryInstruction','TradeConfirmation','Reconciliation']},
   Contract:{Agreement:['LoanAgreement','ISDAAgreement','ServiceAgreement','CustodyAgreement'],Collateral:['CashCollateral','SecurityCollateral','RealEstateCollateral','Lien'],Obligation:['Covenant','Guarantee','Indemnity','Representation']},
   Location:{Region:['Country','StateProvince','City','Jurisdiction'],Facility:['Branch','DataCenter','OfficeBuilding','ATM'],Address:['MailingAddress','LegalAddress','PhysicalAddress']},
   Risk:{CreditRisk:['ProbabilityOfDefault','ExposureAtDefault','CreditRating','LossGivenDefault'],MarketRisk:['ValueAtRisk','SensitivityMeasure','StressScenario','Volatility'],OperationalRisk:['OperationalIncident','ControlTest','LossEvent','KeyRiskIndicator']},
   Compliance:{Regulation:['KYCRule','AMLRule','SanctionsList','ReportingRequirement'],ComplianceCase:['Investigation','Alert','SuspiciousActivityReport','Escalation'],Audit:['AuditFinding','Attestation','PolicyException','RemediationPlan']},
   Reference:{Calendar:['BusinessDay','Holiday','FiscalPeriod'],Currency:['FiatCurrency','CurrencyPair','ExchangeRate','CryptoAsset'],Identifier:['LEI','ISIN','CUSIP','SWIFTCode','TaxId']},
   Product:{FinancialProduct:['CheckingProduct','LoanProduct','InsuranceProduct','CardProduct'],Pricing:['FeeSchedule','InterestRate','RateTier','Promotion'],Channel:['MobileApp','BranchChannel','CallCenter','OnlinePortal']},
   Insurance:{Policy:['LifePolicy','PropertyPolicy','AutoPolicy'],Claim:['ClaimAdjustment','ClaimPayout','ClaimDenial'],Underwriting:['RiskAssessment','Premium','Exclusion']}
  };
  const labels=[], edges=[], ix={};
  const add=(n)=>{ix[n]=labels.length;labels.push(n);return ix[n];};
  const rnd=mulberry32(5);
  Object.entries(D).forEach(([dom,mids])=>{
    const root=add(dom);
    Object.entries(mids).forEach(([mid,leaves])=>{
      const m=add(mid); edges.push({s:m,t:root,kind:'sub'});
      leaves.forEach(l=>{ const k=add(l); edges.push({s:k,t:m,kind:'sub'}); });
      // a few intra-mid / intra-domain relationships
      for(let i=0;i<2;i++){ const a=ix[leaves[(rnd()*leaves.length)|0]], b=ix[leaves[(rnd()*leaves.length)|0]]; if(a!==b) edges.push({s:a,t:b,kind:'prop'}); }
    });
    const ms=Object.keys(mids); for(let i=0;i<ms.length-1;i++) edges.push({s:ix[ms[i]],t:ix[ms[i+1]],kind:'prop'});
  });
  const X=[['Person','Account'],['Account','Instrument'],['Trade','Instrument'],['Trade','LegalEntity'],['Payment','Account'],['Payment','Currency'],['Agreement','Party'],['Collateral','Agreement'],
    ['Instrument','LegalEntity'],['Instrument','Identifier'],['Party','Address'],['Facility','Region'],['CreditRisk','LegalEntity'],['MarketRisk','Instrument'],['ComplianceCase','Party'],['Regulation','Party'],
    ['Audit','Account'],['OperationalIncident','Facility'],['Settlement','Trade'],['Trade','Agreement'],['ExchangeRate','Currency'],['SanctionsList','Party'],['LoanAgreement','LoanAgreement'].slice(0,1).concat('LoanProduct'),
    ['FinancialProduct','Account'],['Pricing','FinancialProduct'],['Channel','Payment'],['Policy','Person'],['Claim','Policy'],['Underwriting','Policy'],['Premium','Payment'],['RiskAssessment','Party'],
    ['Account','Currency'],['Trade','Calendar'],['Collateral','Instrument'],['Jurisdiction','Regulation'],['KeyRiskIndicator','ControlTest'],['LossEvent','Account'],['CreditRating','Instrument'],['TaxAuthority','TaxId'],['Employee','Branch']];
  X.forEach(([a,b])=>{ if(ix[a]===undefined||ix[b]===undefined) console.error('missing',a,b); else edges.push({s:ix[a],t:ix[b],kind:'prop'}); });
  return {labels,edges};
}
function hugeModel(){ const b=bigModel(), K=3, labels=[], edges=[], rnd=mulberry32(11); for(let c=0;c<K;c++){ const off=labels.length; b.labels.forEach(l=>labels.push(l+(c?c:""))); b.edges.forEach(e=>edges.push({s:e.s+off,t:e.t+off,kind:e.kind})); } const nb=b.labels.length; for(let k=0;k<60;k++){ const c1=(rnd()*K)|0, c2=(c1+1+((rnd()*(K-1))|0))%K; edges.push({s:c1*nb+((rnd()*nb)|0),t:c2*nb+((rnd()*nb)|0),kind:"prop"}); } return {labels,edges}; }
const MODELS={
  brewery:{name:'Brewery IoT (24)',load:async()=>({labels:['BrewingRecipe','RecipeSheet','VesselModel','TankSpecs','ValveType','Fitting','BrewTank','Brewery','Kit','DailyGravityRead','Vessel','VesselLocation','Charge','Keg','Pump','Report','Process','Sensor','Order','Cellar','HopsLot','Ingredients','IngredientsBatch'],edges:[{s:0,t:4,kind:'sub'},{s:0,t:1,kind:'prop'},{s:1,t:8,kind:'sub'},{s:1,t:2,kind:'prop'},{s:2,t:4,kind:'sub'},{s:2,t:3,kind:'prop'},{s:3,t:8,kind:'sub'},{s:3,t:4,kind:'prop'},{s:4,t:4,kind:'sub'},{s:5,t:8,kind:'sub'},{s:20,t:13,kind:'sub'},{s:18,t:7,kind:'prop'},{s:10,t:6,kind:'prop'},{s:18,t:7,kind:'prop'},{s:17,t:10,kind:'prop'},{s:10,t:17,kind:'prop'},{s:6,t:0,kind:'prop'},{s:6,t:10,kind:'prop'},{s:7,t:9,kind:'prop'},{s:6,t:11,kind:'prop'},{s:10,t:2,kind:'prop'},{s:10,t:11,kind:'prop'},{s:6,t:12,kind:'prop'},{s:12,t:15,kind:'prop'},{s:17,t:15,kind:'prop'},{s:15,t:16,kind:'prop'},{s:12,t:18,kind:'prop'},{s:11,t:6,kind:'prop'},{s:22,t:21,kind:'prop'},{s:10,t:14,kind:'prop'},{s:7,t:19,kind:'prop'},{s:4,t:5,kind:'prop'},{s:14,t:20,kind:'prop'},{s:14,t:4,kind:'prop'},{s:14,t:10,kind:'prop'},{s:6,t:19,kind:'prop'},{s:5,t:21,kind:'prop'},{s:20,t:22,kind:'prop'}]})},
  parcels:{name:'Parcel delivery (10)',load:async()=>({labels:['Parcel','Station','CargoVan','Handover','Delay','Team','DelayedParcel','Incident','ScanRecord'],edges:[{s:0,t:1,kind:'prop'},{s:0,t:2,kind:'prop'},{s:6,t:0,kind:'sub'},{s:0,t:4,kind:'prop'},{s:0,t:4,kind:'prop'},{s:0,t:5,kind:'prop'},{s:7,t:2,kind:'prop'},{s:8,t:2,kind:'prop'}]})},
  big:{name:'Large invented bank (~180)',load:async()=>bigModel()},
  huge:{name:'Three banks joined (~540)',load:async()=>hugeModel()}
};
