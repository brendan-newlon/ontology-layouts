/* Typical-size ontologies (10-30 classes): the size an analyst actually draws. Same DSL as models2.js. */
const SMALL = {
  uni: `# university: ~16 classes, one clear hierarchy plus course/enrolment links
Person<Student Faculty Staff
Student<Undergraduate Graduate
Faculty<Professor Lecturer
Organization<Department University
Student-Course Department
Faculty-Department Course
Course-Department Faculty
Enrollment-Student Course Semester
Department-University
Graduate-Faculty`,
  hotel: `# hotel booking: ~14 classes, a booking core with several one-link satellites
Room<Suite StandardRoom
Guest-Booking Payment
Booking-Room Guest Rate Payment
Room-Hotel RoomType
Hotel-Address Amenity
Rate-RoomType
Payment-Invoice
Review-Guest Hotel`,
  hr: `# human resources: ~20 classes, two hierarchies joined by assignments
Employee<Manager Contractor Intern
Position<Role JobGrade
Employee-Department Position Payroll
Department-Location CostCenter Employee
Position-JobGrade Department
Payroll-BankAccount Benefit
Benefit-Insurance Pension
Leave-Employee LeaveType
Review-Employee Employee
Training-Employee Skill
Skill-JobGrade`,
  trial: `# clinical trial: ~24 classes, protocol-centred with two satellite clusters
Participant<Patient HealthyVolunteer
Study<PhaseIStudy PhaseIIStudy PhaseIIIStudy
Study-Protocol Sponsor Site Investigator
Protocol-Arm Endpoint Criterion
Arm-Intervention Participant
Participant-Site Consent Visit
Visit-Assessment Study
Assessment-Measurement Investigator
Measurement-Unit Endpoint
AdverseEvent-Participant Intervention Severity
Intervention-Drug
Drug-Manufacturer`,
  grid: `# energy grid: ~28 classes, network with equipment hierarchy
Equipment<Transformer Breaker Line Meter
Asset<Substation Generator Equipment
Generator<SolarFarm WindFarm GasPlant
Substation-Transformer Breaker Region
Line-Substation Substation Voltage
Generator-Substation Fuel
Meter-Customer Substation Tariff
Customer-Account Address Region
Account-Tariff Bill
Bill-Meter Payment
Outage-Line Region Crew
Crew-Equipment Region
WorkOrder-Outage Crew Equipment
Voltage-Unit`,
  pub: `# publishing / library: ~12 classes, shallow with a single hub
Work<Book Article Periodical
Contributor<Author Editor
Contributor-Work Publisher
Edition-Work Publisher Format
Loan-Edition Member
Member-Branch
Branch-Address
Subject-Work`,
  proj: `# project management: ~18 classes, chain plus resource cross-links
Task<Milestone Deliverable
Project-Task Team Budget Risk
Task-Task Resource Deliverable
Resource<Person Equipment Contractor
Team-Person Project
Risk-Task Mitigation Owner
Budget-CostItem Project
CostItem-Task Resource
Issue-Task Person Risk
Owner-Person`
};
Object.keys(SMALL).forEach((k) => { const names = { uni: 'University (16)', hotel: 'Hotel booking (14)', hr: 'HR (20)', trial: 'Clinical trial (24)', grid: 'Energy grid (28)', pub: 'Library (12)', proj: 'Project mgmt (18)' }; MODELS[k] = { name: names[k], load: async () => dslModel(SMALL[k]) }; });
const SMALL_KEYS = Object.keys(SMALL).concat(['brewery', 'parcels']);
