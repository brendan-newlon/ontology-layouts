/* Shapes of well-known public ontologies (written from their published class/property structure, simplified) plus
   synthetic scale-free models. Same DSL as models2.js: "A<B C" = B, C subclasses of A; "A-B C" = A links to B and C. */
const REAL = {
  prov: `# PROV-O: three hubs (Entity, Activity, Agent) plus qualified-relation classes
Agent<Person Organization SoftwareAgent
Entity<Collection Bundle Plan
Collection<EmptyCollection
Influence<EntityInfluence ActivityInfluence AgentInfluence
EntityInfluence<Usage Start End Derivation Invalidation
ActivityInfluence<Generation Communication
AgentInfluence<Attribution Association Delegation
Derivation<Revision Quotation PrimarySource
Entity-Activity Agent Location Generation Attribution Derivation Invalidation
Activity-Entity Agent Location Usage Association Start End Communication
Agent-Location Delegation
Usage-Entity
Generation-Activity
Association-Agent Plan Role
Attribution-Agent
Delegation-Agent Activity
Derivation-Activity Generation Usage
Communication-Activity
Start-Activity
End-Activity
Invalidation-Activity
InstantaneousEvent<Usage Generation Start End Invalidation
InstantaneousEvent-Location Role`,
  sosa: `# SOSA/SSN: observation, actuation and sampling around three activities, system capabilities as a leaf fan
Property<ObservableProperty ActuatableProperty SystemProperty
FeatureOfInterest<Sample
System<Sensor Actuator Sampler
SystemProperty<Accuracy Precision Resolution Latency Frequency Sensitivity DetectionLimit Drift ResponseTime Selectivity
Sensor-ObservableProperty Platform Procedure Observation Stimulus
Observation-ObservableProperty FeatureOfInterest Result Procedure Sample TemporalEntity
Actuator-ActuatableProperty Platform Procedure Actuation
Actuation-ActuatableProperty FeatureOfInterest Result Procedure TemporalEntity
Sampler-Platform Procedure Sampling
Sampling-FeatureOfInterest Sample Procedure Result
Platform-System Deployment
System-System Deployment SystemCapability OperatingRange SurvivalRange
Deployment-Platform Property
FeatureOfInterest-Property
Procedure-Input Output
Stimulus-ObservableProperty
SystemCapability-SystemProperty Condition
OperatingRange-SystemProperty Condition
SurvivalRange-Condition
ObservationCollection-Observation FeatureOfInterest`,
  org: `# W3C Organization ontology with FOAF agents
Agent<Person Organization
Organization<FormalOrganization OrganizationalUnit OrganizationalCollaboration
Organization-Site Membership Post ChangeEvent Organization Identifier
Membership-Agent Role Interval
Post-Role Agent
Site-Address Organization
ChangeEvent-Activity
Person-Post
FormalOrganization-Identifier`,
  pizza: `# Pizza tutorial ontology: deep taxonomy, two properties
DomainConcept<Food Country ValuePartition
Food<Pizza PizzaBase PizzaTopping IceCream
Pizza<NamedPizza CheesyPizza VegetarianPizza SpicyPizza MeatyPizza InterestingPizza RealItalianPizza
NamedPizza<American AmericanHot Cajun Capricciosa Caprina Fiorentina FourSeasons FruttiDiMare Giardiniera LaReine Margherita Mushroom Napoletana Parmense PolloAdAstra PrinceCarlo QuattroFormaggi Rosa Siciliana SloppyGiuseppe Soho Veneziana
PizzaBase<DeepPanBase ThinAndCrispyBase
PizzaTopping<CheeseTopping FishTopping FruitTopping HerbSpiceTopping MeatTopping NutTopping SauceTopping VegetableTopping
CheeseTopping<FourCheesesTopping GoatsCheeseTopping GorgonzolaTopping MozzarellaTopping ParmesanTopping
FishTopping<AnchoviesTopping MixedSeafoodTopping PrawnsTopping
MeatTopping<ChickenTopping HamTopping HotSpicedBeefTopping PeperoniSausageTopping
VegetableTopping<ArtichokeTopping AsparagusTopping CaperTopping GarlicTopping LeekTopping MushroomTopping OliveTopping OnionTopping PepperTopping PetitPoisTopping RocketTopping SpinachTopping TomatoTopping
PepperTopping<GreenPepperTopping JalapenoPepperTopping PeperonataTopping SweetPepperTopping
HerbSpiceTopping<CajunSpiceTopping RosemaryTopping
SauceTopping<TobascoPepperSauce
FruitTopping<SultanaTopping
NutTopping<PineKernels
ValuePartition<Spiciness
Spiciness<Hot Medium Mild
Country<America England France Germany Italy
Pizza-PizzaBase PizzaTopping Country
PizzaTopping-Spiciness
IceCream-FruitTopping`,
  schema: `# schema.org core: taxonomy under Thing with many cross-links between the big types
Thing<CreativeWork Event Organization Person Place Product Action Intangible
CreativeWork<Article Book Movie MusicRecording Review WebPage Recipe Dataset SoftwareApplication Photograph Comment
Organization<Corporation EducationalOrganization LocalBusiness NGO GovernmentOrganization
LocalBusiness<Restaurant Store Hotel MedicalBusiness
Place<City Country LandmarksOrHistoricalBuildings Accommodation
Event<MusicEvent SportsEvent BusinessEvent Festival
Intangible<Offer Rating Brand Audience JobPosting Order Invoice Language Service
Action<BuyAction ReviewAction SearchAction
CreativeWork-Person Organization Place Event Language Rating Audience
Person-Organization Place EducationalOrganization CreativeWork Brand
Organization-Place Person Brand Offer Review
Event-Place Person Organization Offer CreativeWork Audience
Product-Brand Offer Review Rating Organization
Offer-Product Organization Place Service
Review-Rating Person Thing
Order-Offer Person Organization Invoice Product
Invoice-Order Person Organization
Service-Organization Place Offer Audience
JobPosting-Organization Place
Action-Person Organization Place Thing
Rating-Person`,
  crm: `# customer 360: one very large hub
Interaction<Call Email Chat Visit
Customer-Account Address Contact Order Case Opportunity Campaign Segment Subscription Invoice Payment Consent Preference Device Interaction LoyaltyMembership Household Survey Lead Contract Product Asset Quote
Account-Contact Opportunity Case Contract Invoice
Opportunity-Product Quote Campaign Contact
Order-Product Invoice Shipment
Case-Product Contact Agent
Agent-Team
Interaction-Agent Campaign
Subscription-Product Invoice
Invoice-Payment
Shipment-Address`,
  fibo: `# FIBO-shaped loans: party roles, contracts, instruments and many small reference fans
Party<Person LegalEntity GovernmentEntity
LegalEntity<Corporation Partnership Trust FinancialInstitution
FinancialInstitution<Bank CreditUnion InsuranceCompany Broker
PartyRole<Borrower Lender Guarantor Servicer Trustee Underwriter
Loan<MortgageLoan ConsumerLoan CommercialLoan StudentLoan
Contract<LoanAgreement SecurityAgreement GuarantyAgreement
Collateral<RealEstate Vehicle Securities Cash
PartyRole-Party Contract
Loan-LoanAgreement Collateral Borrower Lender Servicer InterestRate PaymentSchedule Currency Jurisdiction
LoanAgreement-Borrower Lender Guarantor Jurisdiction GoverningLaw
SecurityAgreement-Collateral Borrower Lender
GuarantyAgreement-Guarantor Loan
PaymentSchedule-Payment Calendar
Payment-Currency Account
InterestRate<FixedRate FloatingRate
FloatingRate-ReferenceRate Spread
ReferenceRate<SOFR EURIBOR PrimeRate
Account-FinancialInstitution Party Currency
Party-Address Identifier Jurisdiction
Identifier<LEI TaxIdentifier RegistrationNumber
Jurisdiction-Country Regulator
Regulator<CentralBank SecuritiesRegulator
Rating-Party Loan RatingAgency
RatingAgency-LegalEntity`
};
function scaleFree(n, propPerNode, seed) {
  // a forest of subclass trees (branching 2-6) plus property links by preferential attachment: hub-heavy like real enterprise models
  const rnd = mulberry32(seed), labels = [], edges = [], deg = [];
  for (let i = 0; i < n; i++) { labels.push('Class' + i + (i % 3 ? 'Thing' : 'Record')); deg.push(1); }
  for (let i = 1; i < n; i++) if (rnd() < 0.55) { const p = Math.max(0, i - 1 - ((rnd() * 8) | 0)); edges.push({ s: i, t: p, kind: 'sub' }); deg[i]++; deg[p]++; }
  const tot = () => deg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) for (let k = 0; k < propPerNode; k++) if (rnd() < 0.7) {
    let r = rnd() * tot(), j = 0; while (r > deg[j]) { r -= deg[j]; j++; }
    if (j !== i && j < n) { edges.push({ s: i, t: j, kind: 'prop' }); deg[i]++; deg[j]++; }
  }
  return { labels, edges };
}
Object.assign(MODELS, {
  prov: { name: 'PROV-O (~35, three hubs)', load: async () => dslModel(REAL.prov) },
  sosa: { name: 'SOSA/SSN (~40)', load: async () => dslModel(REAL.sosa) },
  org: { name: 'W3C ORG (~17)', load: async () => dslModel(REAL.org) },
  pizza: { name: 'Pizza (~95, taxonomy)', load: async () => dslModel(REAL.pizza) },
  schema: { name: 'schema.org core (~60, hubs)', load: async () => dslModel(REAL.schema) },
  crm: { name: 'Customer 360 (~40, one hub)', load: async () => dslModel(REAL.crm) },
  fibo: { name: 'FIBO loans (~65)', load: async () => dslModel(REAL.fibo) },
  sf60: { name: 'Scale-free 60', load: async () => scaleFree(60, 1.2, 3) },
  sf120: { name: 'Scale-free 120', load: async () => scaleFree(120, 1.2, 5) },
  sf250: { name: 'Scale-free 250', load: async () => scaleFree(250, 1.1, 7) },
  sf400: { name: 'Scale-free 400', load: async () => scaleFree(400, 1.0, 9) }
});
