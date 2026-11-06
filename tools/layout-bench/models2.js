/* More test ontologies, written from the shape of well-known models in different industries.
   DSL: "A<B C D" = A, C, D are subclasses of B;  "A-B C" = A links to B and C (object property). */
function dslModel(text) {
  const labels = [], ix = {}, edges = [], add = (n) => { if (ix[n] === undefined) { ix[n] = labels.length; labels.push(n); } return ix[n]; };
  text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).forEach((l) => {
    let m;
    if ((m = l.match(/^([^<\-\s]+)<(.+)$/))) { const sup = add(m[1]); m[2].trim().split(/\s+/).forEach((c) => edges.push({ s: add(c), t: sup, kind: 'sub' })); }
    else if ((m = l.match(/^([^<\-\s]+)-(.+)$/))) { const a = add(m[1]); m[2].trim().split(/\s+/).forEach((c) => edges.push({ s: a, t: add(c), kind: 'prop' })); }
  });
  return { labels, edges };
}
const HEALTH = `
# clinical record, FHIR-shaped: hub-and-spoke around Patient and Encounter
Observation<VitalSign LabResult SocialHistory ImagingResult
Condition<Diagnosis ProblemListItem
Practitioner<Physician Nurse Pharmacist
Organization<Hospital Clinic Laboratory Payer
Patient-Practitioner Organization Coverage Consent
Encounter-Patient Practitioner Location Organization Condition Procedure
Observation-Patient Encounter Specimen Device Practitioner
Condition-Patient Encounter Practitioner
Procedure-Patient Encounter Practitioner Device Location
MedicationRequest-Patient Encounter Practitioner Medication Condition
MedicationAdministration-MedicationRequest Patient Practitioner Medication
Medication-Substance Organization
Immunization-Patient Encounter Practitioner Medication
AllergyIntolerance-Patient Substance Practitioner
DiagnosticReport-Patient Encounter Observation Specimen Practitioner Laboratory ImagingStudy
ImagingStudy-Patient Encounter Device
Specimen-Patient Practitioner
CarePlan-Patient Condition Goal CareTeam Encounter
CareTeam-Patient Practitioner Organization
Goal-Patient Condition
ServiceRequest-Patient Encounter Practitioner Organization Condition
Task-ServiceRequest Practitioner Patient
Appointment-Patient Practitioner Location Slot
Slot-Schedule
Schedule-Practitioner Location
Location-Organization
Device-Patient Organization Location
Coverage-Patient Payer
Claim-Patient Coverage Encounter Practitioner Organization Procedure
ClaimResponse-Claim Payer
Invoice-Patient Claim Account
Account-Patient Organization
DocumentReference-Patient Encounter Practitioner
Communication-Patient Practitioner Encounter
FamilyMemberHistory-Patient Condition
RelatedPerson-Patient
Questionnaire-Organization
QuestionnaireResponse-Questionnaire Patient Encounter
PractitionerRole-Practitioner Organization Location HealthcareService
HealthcareService-Organization Location
`;
const SUPPLY = `
# manufacturing and logistics: layered process chain
Supplier-Contract Material Part
PurchaseOrder-Supplier Warehouse Contract
POLine-PurchaseOrder Part Material
Shipment-Carrier Route Warehouse Plant
InboundShipment<ASN Return
Carrier-Contract Route
Route-Stop Plant Warehouse
Stop-Location
Warehouse-Location StorageBin Inventory
StorageBin-Inventory
Inventory-Part Lot Material
Lot-Part Supplier QualityInspection
SerialNumber-Part Lot Product
Part-BOMLine Material
BOM-Product BOMLine
BOMLine-Part
Product-Category BOM
WorkOrder-Product WorkCenter Operation Plant Lot
Operation-WorkCenter Machine Routing
Routing-Product Operation
WorkCenter-Plant Machine
Machine-Plant MaintenanceOrder
MaintenanceOrder-Machine Technician
QualityInspection-WorkOrder Defect Operation
Defect-Part Operation
SalesOrder-Customer Product Shipment Contract
SOLine-SalesOrder Product
Customer-Location Contract
Forecast-Product Customer
Invoice-SalesOrder Customer
Plant-Location
Location-Region
`;
const TELECOM = `
# network operator: dense mesh of equipment, topology and service
Subscriber-Account Device SIM Plan
Account-Bill Plan Subscriber
Bill-Charge Payment
Charge-Usage Plan
Usage-SIM Cell
SIM-Device Plan
Plan-Service
Service-Circuit Subscriber Site
Circuit-Link Port Trunk
Link-Port Router Switch Fiber
Port-Router Switch
Router-Site Link Vlan Switch
Switch-Site Vlan Link
Vlan-Switch Router Circuit
Trunk-Fiber Site Router
Fiber-Cable Site Duct
Cable-Duct Site
Site-Region Tower Power
Tower-Antenna Site Cell Power
Antenna-Sector Tower
Sector-Cell Antenna
Cell-Tower Sector Router Handover
Handover-Cell Subscriber
Alarm-Router Switch Cell Link Power Fiber
Outage-Alarm Site Service Ticket Region
Ticket-Technician Outage Site Customer
Technician-Region Site
Customer-Account Service Ticket
Power-Site Battery
Battery-Site
`;
const RETAIL = `
# e-commerce: dense core of order, catalogue and fulfilment, with many payment and promotion leaves
Payment<CardPayment BankTransfer Wallet GiftCardPayment CashOnDelivery
Promotion<Coupon Discount BundleOffer LoyaltyReward
Shipment<Parcel Pallet
Customer-Address Order Cart Wishlist Review LoyaltyAccount
Address-Region
Order-Customer OrderLine Payment Shipment Promotion Address Channel
OrderLine-Order Variant Promotion
Cart-Customer CartLine Promotion
CartLine-Cart Variant
Wishlist-Customer Product
Product-Category Brand Variant Supplier Review
Variant-Product Inventory Price
Price-Variant Promotion Region Currency
Category-Category Promotion
Brand-Supplier
Inventory-Variant Warehouse
Warehouse-Region Shipment
Shipment-Order Carrier Warehouse Address
Carrier-Region
Payment-Order Customer Currency Refund
Refund-Payment OrderLine Return
Return-OrderLine Customer Warehouse
Review-Customer Product Order
LoyaltyAccount-Customer LoyaltyReward Order
Promotion-Channel Region
Channel-Region
Supplier-Region Product
Currency-Region
`;
function bioModel() {
  // deep taxonomy with a few cross-relations (gene-ontology / biomedical shape), generated from a nested list
  const T = { BiologicalEntity: { MolecularEntity: { Gene: ['ProteinCodingGene', 'NonCodingGene', 'Pseudogene', 'MitochondrialGene'], Protein: ['Enzyme', 'Receptor', 'TranscriptionFactor', 'StructuralProtein', 'Transporter', 'Antibody'], SmallMolecule: ['Metabolite', 'Drug', 'Lipid', 'Hormone', 'Vitamin'], NucleicAcid: ['DNA', 'RNA', 'mRNA', 'tRNA', 'miRNA'] },
      CellularComponent: { Organelle: ['Nucleus', 'Mitochondrion', 'GolgiApparatus', 'EndoplasmicReticulum', 'Lysosome', 'Ribosome'], Membrane: ['PlasmaMembrane', 'NuclearMembrane', 'MitochondrialMembrane'], Cytoskeleton: ['Microtubule', 'ActinFilament'] },
      BiologicalProcess: { Metabolism: ['Glycolysis', 'KrebsCycle', 'LipidMetabolism', 'ProteinSynthesis'], Signaling: ['KinaseCascade', 'CalciumSignaling', 'HormoneSignaling'], CellCycle: ['Mitosis', 'Meiosis', 'DNAReplication'], ImmuneResponse: ['InnateResponse', 'AdaptiveResponse', 'Inflammation'] },
      Anatomy: { Tissue: ['EpithelialTissue', 'MuscleTissue', 'NervousTissue', 'ConnectiveTissue'], Organ: ['Heart', 'Liver', 'Kidney', 'Lung', 'Brain', 'Skin'], CellType: ['Neuron', 'Hepatocyte', 'Lymphocyte', 'Erythrocyte', 'Fibroblast'] },
      Organism: { Eukaryote: ['Human', 'Mouse', 'Zebrafish', 'Yeast', 'Fly'], Prokaryote: ['EColi', 'Bacillus'], Virus: ['Coronavirus', 'Retrovirus', 'Bacteriophage'] },
      Disease: { GeneticDisease: ['CysticFibrosis', 'SickleCellDisease', 'HuntingtonDisease'], InfectiousDisease: ['Influenza', 'Tuberculosis', 'Malaria'], Cancer: ['LungCancer', 'BreastCancer', 'Leukemia'], MetabolicDisease: ['Diabetes', 'Phenylketonuria'] },
      Phenotype: { Morphological: ['Height', 'EyeColor'], Physiological: ['BloodPressure', 'GlucoseLevel'] } } };
  const labels = [], edges = [], ix = {}, add = (n) => { if (ix[n] === undefined) { ix[n] = labels.length; labels.push(n); } return ix[n]; };
  const walk = (parent, node) => { if (Array.isArray(node)) node.forEach((c) => edges.push({ s: add(c), t: add(parent), kind: 'sub' })); else Object.entries(node).forEach(([k, v]) => { edges.push({ s: add(k), t: add(parent), kind: 'sub' }); walk(k, v); }); };
  Object.entries(T).forEach(([root, kids]) => { add(root); walk(root, kids); });
  [['Gene', 'Protein'], ['Protein', 'BiologicalProcess'], ['Protein', 'CellularComponent'], ['Enzyme', 'Metabolite'], ['Drug', 'Receptor'], ['Drug', 'Disease'], ['Gene', 'Disease'], ['Gene', 'Phenotype'], ['Disease', 'Organ'], ['Disease', 'Phenotype'], ['Organism', 'Disease'], ['Virus', 'CellType'], ['Neuron', 'BrainRegionSignal'].slice(0, 1).concat('Brain'), ['Hormone', 'Receptor'], ['TranscriptionFactor', 'Gene'], ['mRNA', 'Gene'], ['Ribosome', 'mRNA'], ['Mitosis', 'Nucleus'], ['Inflammation', 'Tissue'], ['Antibody', 'Virus'], ['Liver', 'Metabolism'], ['Heart', 'BloodPressure'], ['Kidney', 'BloodPressure'], ['Diabetes', 'GlucoseLevel'], ['Human', 'Organ']].forEach(([a, b]) => edges.push({ s: add(a), t: add(b), kind: 'prop' }));
  return { labels, edges };
}
function meshModel() {
  // abstract stress case: 70 classes, every class linked to 3-4 others at random (no hierarchy)
  const rnd = mulberry32(21), n = 70, labels = Array.from({ length: n }, (_, i) => 'Class' + (i + 1)), edges = [], seen = new Set();
  for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { const j = (rnd() * n) | 0; const key = Math.min(i, j) + ',' + Math.max(i, j); if (i !== j && !seen.has(key)) { seen.add(key); edges.push({ s: i, t: j, kind: 'prop' }); } }
  return { labels, edges };
}
Object.assign(MODELS, {
  health: { name: 'Healthcare record (~50)', load: async () => dslModel(HEALTH) },
  supply: { name: 'Supply chain (~45)', load: async () => dslModel(SUPPLY) },
  telecom: { name: 'Telecom network (~35, dense)', load: async () => dslModel(TELECOM) },
  retail: { name: 'E-commerce (~55)', load: async () => dslModel(RETAIL) },
  bio: { name: 'Biomedical taxonomy (~125, deep tree)', load: async () => bioModel() },
  mesh: { name: 'Random mesh (70, no structure)', load: async () => meshModel() }
});
