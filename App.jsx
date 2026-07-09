import React, { useState, useMemo } from "react";
import {
  LayoutDashboard, Handshake, Users, Building2, Scale, Wallet, ClipboardList,
  PackageCheck, FileText, History, Search, Plus, X, ChevronRight, ChevronDown,
  AlertTriangle, Copy, Check, Filter, LogOut, Briefcase, ArrowLeft, Pencil,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* =========================================================================
   QUICKENS TALENT MANAGEMENT OS — MVP PROTOTYPE
   In-memory state only. Structured so each entity (talents, projects, legal,
   finance, pm, deliverables, documents, activity logs) maps 1:1 onto the
   future Supabase/Postgres tables described in the PRD.
   ========================================================================= */

// ---------------------------------------------------------------------------
// CONSTANTS / ENUMS
// ---------------------------------------------------------------------------
const ROLES = {
  admin: "Admin / Management",
  partnership: "Partnership Team",
  legal: "Legal Team",
  finance: "Finance Operations",
  pm: "Project Manager",
};

const CLIENT_STATUS = ["New Prospect","Warm Lead","Existing Client","Confirmed Client","Lost Client","Inactive"];
const PROJECT_STATUS = ["New Inquiry","Pitching","Negotiation","Verbal Lock","Confirmed","On Going","Realized","Completed","Lost","Cancelled","On Hold"];
const PIPELINE_STAGE = ["New Lead","Contacted","Pitching","Negotiation","Verbal Lock","Confirmed","Realized","Lost","Cancelled","On Hold"];
const TAX_ENTITY = ["Individual","CV","PT","Non-NPWP Individual","Other"];
const TAX_METHOD = ["Gross Up","Non Gross Up","No Tax","Custom Manual"];
const TALENT_TYPE = ["Creator","Influencer","Celebrity","Host","Speaker","Model","Community","Other"];
const TALENT_STATUS = ["Active","Inactive","Priority","Blacklist","Under Review"];
const EXCLUSIVITY = ["Exclusive","Non-exclusive","Project-based","Inactive"];
const LEGAL_STATUS = ["Not Started","Waiting Data","Drafting SPK","Sent to Client","Waiting Signature","Signed","Completed","Need Revision","Issue / Blocked"];
const FINANCE_STATUS = ["Not Invoiced","Invoice Drafted","Invoice Sent","Waiting Payment","Followed Up","Paid by Client","Tax Document Pending","Talent Payment Pending","Talent Paid","Completed","Issue / Blocked"];
const PROGRESS = ["Waiting Brief","Waiting Product","Brief Received","Talent Briefed","Content Production","Draft Submitted","Revision","Waiting Approval","Approved","Scheduled","Posted","Reported","Completed","Overdue","Issue / Blocked"];
const STORYLINE_REQUIRED = ["Yes","No","To Be Confirmed"];
const STORYLINE_STATUS = ["Not Needed","Waiting Brief","In Draft","Sent to Brand","Revision","Approved"];
const DELIVERABLE_TYPE = ["IG Reels","IG Story","TikTok Video","YouTube Video","Livestream","Event Attendance","BA Placement","Photo","Carousel","Other"];
const DELIVERABLE_STATUS = ["Not Started","Waiting Brief","In Progress","Submitted","Revision","Approved","Scheduled","Posted","Reported","Completed","Overdue","Cancelled"];
const DOC_TYPE = ["SPK","Invoice","NPWP","Bukti Potong Pajak","Bukti Bayar","Rate Card","Addendum","Contract","Quotation","Other"];
const NPWP_STATUS = ["Has NPWP","No NPWP","In Process"];
const CHART_COLORS = ["#6366f1","#3b82f6","#10b981","#f59e0b","#ef4444","#a855f7","#14b8a6","#f97316","#64748b"];

const LOCKED_STAGES = ["Verbal Lock","Confirmed","Realized"];
const CONFIRMED_STATUSES = ["Confirmed","On Going","Completed","Realized"];
// Whole Company / Individual Sales Report definitions (Dashboard §1.2):
// secured = deal is locked in, whether or not it has finished; realized = fully closed out.
const SECURED_STATUSES = ["Verbal Lock","Confirmed","On Going","Realized","Completed"];
const REALIZED_STATUSES = ["Realized","Completed"];
const ACTIVE_PIPELINE_STATUSES_EXCLUDE = ["Lost","Cancelled","Realized","Completed"];

// Optional sales targets for the Secured Project Achievement section (Dashboard §1.5).
// Leave a user out of USER_TARGETS (or set COMPANY_TARGETS to null) to fall back to
// showing the raw secured count with no achievement percentage — per spec, targets
// are optional and the dashboard should degrade gracefully when they're not set.
const COMPANY_TARGETS = {
  monthlySecuredValue: 150000000, yearlySecuredValue: 1500000000,
  monthlySecuredProjects: 8, yearlySecuredProjects: 80,
};
const USER_TARGETS = {
  "Dinda Partnership": { monthlySecuredValue: 60000000, yearlySecuredValue: 600000000, monthlySecuredProjects: 3, yearlySecuredProjects: 30 },
  // Bagas Partnership intentionally has no target set, to demonstrate the
  // "just show the count, no percentage" fallback described in the spec.
};

// Friendly Activity Log labels for generic field-diff logging (Dashboard/Confirmation §5).
const FIELD_LABELS = {
  pipelineValue: "Pipeline Estimated Value",
  lockedValue: "Project Value Deal / Locked Value",
  realizedValue: "Realized Value",
  lockedSOWDetails: "Locked SOW Details",
  projectStatus: "Project status",
  pipelineStage: "Pipeline stage",
  clientStatus: "Client status",
  dateVerbalLock: "Date Verbal Lock",
  dateProjectConfirmed: "Date Project Confirmed",
  dateProjectRealized: "Date Project Realized",
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
let idCounters = { project: 1, talent: 1, deliverable: 1, document: 1, log: 1 };
const genId = (prefix) => {
  const n = idCounters[prefix]++;
  const pad = String(n).padStart(4, "0");
  const map = { project: "PRJ", talent: "TAL", deliverable: "DLV", document: "DOC", log: "LOG" };
  return `${map[prefix]}-${pad}`;
};

// Project ID logic: QTM-{global sequence}-{talent code}-{talent yearly sequence}
// e.g. QTM-0007-NDA-03 = 7th project ever created agency-wide, for talent code
// "NDA", the 3rd project that talent has been booked on this calendar year.
// Projects without a talent yet fall back to a "GEN" (general/unassigned) code.
let globalProjectSeq = 0;
let talentYearlySeq = {};
function genProjectId(talentCode, dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const code = (talentCode || "GEN").toUpperCase();
  globalProjectSeq += 1;
  const key = `${code}-${year}`;
  talentYearlySeq[key] = (talentYearlySeq[key] || 0) + 1;
  return `QTM-${String(globalProjectSeq).padStart(4, "0")}-${code}-${String(talentYearlySeq[key]).padStart(2, "0")}`;
}

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const fmtIDR = (n) => {
  if (n === undefined || n === null || n === "") return "Rp 0";
  return "Rp " + Math.round(Number(n)).toLocaleString("id-ID");
};
const isPast = (d) => d && new Date(d) < new Date(new Date().toDateString());

// ---------------------------------------------------------------------------
// PROJECT CONFIRMATION TEMPLATES — default, admin-editable, per §4
// ---------------------------------------------------------------------------
const DEFAULT_BRAND_TEMPLATE = `Hi Kak,

Berikut adalah group untuk koordinasi project *{{talent_name}} x {{brand_name}}*.

Di group ini ada:
Saya, {{partnership_pic_name}} sebagai perwakilan dari *Partnership Team*
{{pm_pic_name}} → {{pm_pic_whatsapp}} sebagai *Project Manager Team*
{{legal_pic_name}} → {{legal_pic_whatsapp}} sebagai *Legal Team*
{{finance_pic_name}} → {{finance_pic_whatsapp}} sebagai *Finance Team*
and also Kak {{oversight_pic_name}} {{oversight_pic_whatsapp}} yang akan membantu oversight this project

Kami izin mengonfirmasi kembali detail project sebagai berikut:

📌 *PROJECT CONFIRMATION*
*Talent* : {{talent_name}}
*Brand* : {{brand_name}}
*Scope of Work (SOW)* :
{{locked_sow_details}}
*Timeline* : {{timeline}}
*Project Value* : {{project_value_deal}}
*DPP Gross Up* : {{dpp_gross_up}}
*Tax Applied* : {{tax_applied}}
*Amount to be Paid* : {{amount_to_be_paid}}
*Term of Payment (ToP)* : {{top_agreement}}

We look forward to a smooth and successful partnership.
Thank you for trusting us!`;

const DEFAULT_TALENT_TEMPLATE = `Hi {{talent_name}},

Here are the details of our collaboration project with *{{brand_name}}*.

📌 *QUICKENS'S TALENT PROJECT CONFIRMATION*
*Talent* : {{talent_name}}
*Brand* : {{brand_name}}
*Scope of Work (SOW)* :
{{locked_sow_details}}
*Post Timeline / Due Date* : {{post_timeline_or_due_date}}
*Project Amount* : {{project_amount}}
*Term of Payment (ToP)* : {{top_agreement}}
*Date of Confirmation* : {{date_of_confirmation}}

Kindly review the details above and let us know if everything is in order 🙏
Should there be any adjustments needed, please don't hesitate to inform us.

Thank you so much 💙
- Quickens Agency`;

function renderTemplate(template, vars) {
  return (template || "").replace(/\{\{(\w+)\}\}/g, (match, key) => (key in vars ? vars[key] : match));
}

function findUserWhatsapp(users, name) {
  const u = users.find((u) => u.name === name);
  return u?.whatsapp || "—";
}

function buildConfirmationVars(project, talents, users) {
  const projectTalents = talents.filter((t) => project.talentIds.includes(t.id));
  const talentNames = projectTalents.map((t) => t.name).join(", ") || "TBD";
  const taxResult = calcTax(project.toTalent, project.taxUsed, project.taxMethod);
  return {
    talent_name: talentNames,
    brand_name: project.brandName || "-",
    locked_sow_details: project.lockedSOWDetails || project.sow || "-",
    timeline: project.expectedTimeline || "-",
    project_value_deal: fmtIDR(project.lockedValue),
    dpp_gross_up: fmtIDR(taxResult.gross),
    tax_applied: project.taxApplied ? `${project.taxMethod} (${(project.taxUsed * 100).toFixed(2)}%)` : "No Tax",
    amount_to_be_paid: fmtIDR(project.totalPrice),
    top_agreement: project.topAgreement || "-",
    partnership_pic_name: project.partnershipPIC || "-",
    pm_pic_name: project.pmPIC || "Unassigned",
    pm_pic_whatsapp: project.pmPIC ? findUserWhatsapp(users, project.pmPIC) : "-",
    legal_pic_name: project.legalPIC || "Unassigned",
    legal_pic_whatsapp: project.legalPIC ? findUserWhatsapp(users, project.legalPIC) : "-",
    finance_pic_name: project.financePIC || "Unassigned",
    finance_pic_whatsapp: project.financePIC ? findUserWhatsapp(users, project.financePIC) : "-",
    oversight_pic_name: project.oversightPICName || "-",
    oversight_pic_whatsapp: project.oversightPICWhatsapp || "-",
    post_timeline_or_due_date: project.pm?.estimatedPostingDueDate ? fmtDate(project.pm.estimatedPostingDueDate) : (project.expectedTimeline || "TBD"),
    project_amount: fmtIDR(taxResult.net),
    date_of_confirmation: fmtDate(today()),
  };
}

function calcTax(netFee, rate, method) {
  const fee = Number(netFee) || 0;
  const r = Number(rate) || 0;
  if (method === "No Tax") return { gross: fee, tax: 0, net: fee };
  if (method === "Non Gross Up") {
    const tax = fee * r;
    return { gross: fee, tax, net: fee - tax };
  }
  if (method === "Gross Up") {
    const gross = r < 1 ? fee / (1 - r) : fee;
    const tax = gross * r;
    return { gross, tax, net: gross - tax };
  }
  // Custom Manual — caller supplies tax amount separately
  return { gross: fee, tax: 0, net: fee };
}

// Partnership value & pipeline metrics — shared by the Logbook summary bar
// and the role dashboards so "my numbers" and "team numbers" always agree.
function partnershipMetrics(list) {
  const pipeline = list.reduce((s, p) => s + p.pipelineValue, 0);
  const secured = list.reduce((s, p) => s + p.lockedValue, 0);
  const realized = list.reduce((s, p) => s + p.realizedValue, 0);
  const activeLeads = list.filter((p) => !["Cancelled", "Lost", "Completed", "Realized"].includes(p.projectStatus)).length;
  const verbalLock = list.filter((p) => p.pipelineStage === "Verbal Lock").length;
  const confirmed = list.filter((p) => p.projectStatus === "Confirmed").length;
  const realizedCount = list.filter((p) => p.projectStatus === "Realized").length;
  const lost = list.filter((p) => p.projectStatus === "Lost" || p.projectStatus === "Cancelled").length;
  return { pipeline, secured, realized, activeLeads, verbalLock, confirmed, realizedCount, lost };
}

// ---------------------------------------------------------------------------
// STATUS COLORS
// ---------------------------------------------------------------------------
const badgeTone = (status) => {
  const green = ["Confirmed","Completed","Signed","Paid by Client","Talent Paid","Realized","Approved","Posted","Active","Existing Client","Confirmed Client","Payment Success"];
  const blue = ["On Going","Verbal Lock","Negotiation","Waiting Signature","Waiting Payment","Content Production","Drafting SPK","In Progress","Warm Lead","Pitching","Scheduled"];
  const amber = ["New Inquiry","New Prospect","New Lead","Waiting Client Confirmation","Waiting Data","Not Invoiced","Waiting Brief","Not Started","Priority","Under Review","To Be Confirmed"];
  const red = ["Cancelled","Lost","Lost Client","Overdue","Issue / Blocked","Blacklist","Need Revision"];
  if (green.includes(status)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (blue.includes(status)) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (amber.includes(status)) return "bg-amber-50 text-amber-800 ring-amber-200";
  if (red.includes(status)) return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
};

const Badge = ({ children }) => (
  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${badgeTone(children)}`}>
    {children}
  </span>
);

const OverdueTag = () => (
  <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
    <AlertTriangle size={11} /> Overdue
  </span>
);

// ---------------------------------------------------------------------------
// SEED DATA
// ---------------------------------------------------------------------------
const seedUsers = [
  { id: "u1", name: "Rani Admin", role: "admin", whatsapp: "0821-1000-0001" },
  { id: "u2", name: "Dinda Partnership", role: "partnership", whatsapp: "0821-1000-0002" },
  { id: "u3", name: "Bagas Partnership", role: "partnership", whatsapp: "0821-1000-0003" },
  { id: "u4", name: "Yusuf Legal", role: "legal", whatsapp: "0821-1000-0004" },
  { id: "u5", name: "Sari Finance", role: "finance", whatsapp: "0821-1000-0005" },
  { id: "u6", name: "Fajar PM", role: "pm", whatsapp: "0821-1000-0006" },
];

const seedTalents = [
  {
    id: genId("talent"), talentCode: "NDA", name: "Nadia Putri", category: "Beauty & Lifestyle", type: "Creator",
    ig: "@nadiaputri", tiktok: "@nadiaputri", youtube: "-", followers: "IG 850K / TT 1.2M", engagementRate: "4.8%",
    audienceDemo: "Female 18-30", audienceLocation: "Jabodetabek", rateCard: 15000000, talentFee: 12000000, managementFee: 20,
    contact: "Manajer: Rio", whatsapp: "0812xxxxxxx", email: "nadia.mgmt@example.com",
    npwpNumber: "09.123.456.7-012.000", npwpName: "CV Nadia Kreatif", npwpStatus: "Has NPWP",
    taxEntityType: "CV", defaultTaxRate: 0.005, taxNotes: "Payment via CV Nadia Kreatif",
    bankName: "BCA", bankAccountName: "CV Nadia Kreatif", bankAccountNumber: "1234567890",
    address: "Jl. Kemang Raya No. 12", city: "Jakarta Selatan", province: "DKI Jakarta", postalCode: "12730", country: "Indonesia",
    contractStatus: "Active", exclusivity: "Non-exclusive", status: "Active", notes: "Priority for beauty campaigns",
    createdBy: "Dinda Partnership", updatedBy: "Dinda Partnership", createdAt: "2026-01-10", updatedAt: "2026-05-02",
  },
  {
    id: genId("talent"), talentCode: "BRM", name: "Bram Satria", category: "Tech & Gadget", type: "Influencer",
    ig: "@bramsatria", tiktok: "@bramsatria", youtube: "Bram Satria", followers: "IG 320K / YT 500K", engagementRate: "3.9%",
    audienceDemo: "Male 20-35", audienceLocation: "National", rateCard: 9000000, talentFee: 8000000, managementFee: 15,
    contact: "Self-managed", whatsapp: "0813xxxxxxx", email: "bram.satria@example.com",
    npwpNumber: "08.234.567.8-013.000", npwpName: "Bram Satria", npwpStatus: "Has NPWP",
    taxEntityType: "Individual", defaultTaxRate: 0.025, taxNotes: "Standard PPh21",
    bankName: "Mandiri", bankAccountName: "Bram Satria", bankAccountNumber: "9988776655",
    address: "Jl. Sudirman Kav. 45", city: "Jakarta Pusat", province: "DKI Jakarta", postalCode: "10220", country: "Indonesia",
    contractStatus: "Active", exclusivity: "Project-based", status: "Active", notes: "",
    createdBy: "Bagas Partnership", updatedBy: "Bagas Partnership", createdAt: "2026-01-15", updatedAt: "2026-04-20",
  },
  {
    id: genId("talent"), talentCode: "KRN", name: "Kirana Ayu", category: "Food & Travel", type: "Creator",
    ig: "@kiranaayu", tiktok: "@kiranaayu", youtube: "-", followers: "IG 1.4M / TT 2.1M", engagementRate: "5.6%",
    audienceDemo: "Female 18-35", audienceLocation: "National", rateCard: 25000000, talentFee: 20000000, managementFee: 20,
    contact: "Manajer: Sinta", whatsapp: "0815xxxxxxx", email: "kirana.mgmt@example.com",
    npwpNumber: "07.345.678.9-014.000", npwpName: "PT Kirana Media", npwpStatus: "Has NPWP",
    taxEntityType: "PT", defaultTaxRate: 0.02, taxNotes: "Invoice via PT Kirana Media",
    bankName: "BNI", bankAccountName: "PT Kirana Media", bankAccountNumber: "5544332211",
    address: "Jl. Braga No. 88", city: "Bandung", province: "Jawa Barat", postalCode: "40111", country: "Indonesia",
    contractStatus: "Active", exclusivity: "Exclusive", status: "Priority", notes: "Top-tier, book early",
    createdBy: "Dinda Partnership", updatedBy: "Dinda Partnership", createdAt: "2026-02-01", updatedAt: "2026-06-01",
  },
  {
    id: genId("talent"), talentCode: "DMS", name: "Dimas Wirawan", category: "Gaming", type: "Influencer",
    ig: "@dimaswirawan", tiktok: "@dimaswirawan", youtube: "Dimas W Gaming", followers: "IG 200K / YT 900K", engagementRate: "6.2%",
    audienceDemo: "Male 15-25", audienceLocation: "National", rateCard: 7000000, talentFee: 6000000, managementFee: 15,
    contact: "Self-managed", whatsapp: "0817xxxxxxx", email: "dimas.w@example.com",
    npwpNumber: "", npwpName: "", npwpStatus: "No NPWP",
    taxEntityType: "Non-NPWP Individual", defaultTaxRate: 0.05, taxNotes: "Higher rate — no NPWP",
    bankName: "BRI", bankAccountName: "Dimas Wirawan", bankAccountNumber: "1122334455",
    address: "Jl. Diponegoro No. 5", city: "Surabaya", province: "Jawa Timur", postalCode: "60241", country: "Indonesia",
    contractStatus: "Active", exclusivity: "Non-exclusive", status: "Active", notes: "",
    createdBy: "Bagas Partnership", updatedBy: "Bagas Partnership", createdAt: "2026-03-01", updatedAt: "2026-05-10",
  },
];

function blankProjectExtras() {
  return {
    legal: null, finance: null, pm: null, deliverables: [], documents: [],
    brandConfirmationMessage: "", talentConfirmationMessage: "",
    lockedSOWDetails: "", oversightPICName: "", oversightPICWhatsapp: "", valueAdjustmentNotes: "",
  };
}

const seedProjects = [
  {
    id: genProjectId(seedTalents[0].talentCode, "2026-05-02"),
    createdBy: "u2",
    partnershipPIC: "Dinda Partnership", legalPIC: "Yusuf Legal", financePIC: "Sari Finance", pmPIC: "Fajar PM",
    dateInserted: "2026-05-02", dateUpdated: "2026-06-20",
    name: "Glowlight Serum Launch", prospectiveClient: "Glowlight Cosmetics", prospectiveBrand: "Glowlight",
    brandName: "Glowlight", companyName: "PT Glowlight Indonesia", agencyName: "-",
    picName: "Anisa Rahma", picPosition: "Brand Manager", picWhatsapp: "0811xxxxxxx", picEmail: "anisa@glowlight.co.id",
    leadSource: "Referral", clientStatus: "Confirmed Client", projectSource: "Direct Brand",
    talentIds: [seedTalents[0].id], sow: "1 IG Reels + 3 IG Story", expectedTimeline: "2 weeks",
    projectStatus: "Confirmed", pipelineStage: "Confirmed", topAgreement: "14 days after invoice", notes: "Serum launch campaign",
    groupName: "Glowlight x Quickens", pipelineValue: 18000000, lockedValue: 18000000, realizedValue: 0,
    totalPrice: 18000000, toTalent: 12000000, managementFee: 3000000, dppGrossUp: null, taxApplied: true,
    defaultTax: 0.005, customTax: null, taxUsed: 0.005, taxMethod: "Gross Up",
    dateFirstContacted: "2026-04-20", datePitchSent: "2026-04-25", dateVerbalLock: "2026-05-01",
    dateProjectConfirmed: "2026-05-02", dateProjectRealized: "", dateProjectCancelled: "",
    ...blankProjectExtras(),
  },
  {
    id: genProjectId(seedTalents[1].talentCode, "2026-06-10"),
    createdBy: "u3",
    partnershipPIC: "Bagas Partnership", legalPIC: "", financePIC: "", pmPIC: "",
    dateInserted: "2026-06-10", dateUpdated: "2026-06-25",
    name: "TechNova Gadget Review", prospectiveClient: "TechNova", prospectiveBrand: "TechNova",
    brandName: "TechNova", companyName: "PT TechNova Digital", agencyName: "Ada Agency",
    picName: "Rendra Wijaya", picPosition: "Marketing Lead", picWhatsapp: "0822xxxxxxx", picEmail: "rendra@technova.id",
    leadSource: "Inbound", clientStatus: "Warm Lead", projectSource: "Agency",
    talentIds: [seedTalents[1].id, seedTalents[3].id], sow: "2 YouTube Video Review", expectedTimeline: "3 weeks",
    projectStatus: "Negotiation", pipelineStage: "Negotiation", topAgreement: "30 days", notes: "Waiting on final budget approval",
    groupName: "TechNova x Quickens", pipelineValue: 25000000, lockedValue: 0, realizedValue: 0,
    totalPrice: 25000000, toTalent: 14000000, managementFee: 3500000, dppGrossUp: null, taxApplied: true,
    defaultTax: 0.025, customTax: null, taxUsed: 0.025, taxMethod: "Gross Up",
    dateFirstContacted: "2026-06-01", datePitchSent: "2026-06-05", dateVerbalLock: "",
    dateProjectConfirmed: "", dateProjectRealized: "", dateProjectCancelled: "",
    ...blankProjectExtras(),
  },
  {
    id: genProjectId(seedTalents[2].talentCode, "2026-04-01"),
    createdBy: "u2",
    partnershipPIC: "Dinda Partnership", legalPIC: "Yusuf Legal", financePIC: "Sari Finance", pmPIC: "Fajar PM",
    dateInserted: "2026-04-01", dateUpdated: "2026-06-28",
    name: "Kirana Food Festival Livestream", prospectiveClient: "Rasa Nusantara", prospectiveBrand: "Rasa Nusantara",
    brandName: "Rasa Nusantara", companyName: "PT Rasa Nusantara Group", agencyName: "-",
    picName: "Wulan Sari", picPosition: "Head of Marketing", picWhatsapp: "0855xxxxxxx", picEmail: "wulan@rasanusantara.id",
    leadSource: "Referral", clientStatus: "Existing Client", projectSource: "Direct Brand",
    talentIds: [seedTalents[2].id], sow: "1 Livestream + 2 IG Reels", expectedTimeline: "4 weeks",
    projectStatus: "On Going", pipelineStage: "Confirmed", topAgreement: "14 days after invoice", notes: "High-profile client",
    groupName: "Rasa Nusantara x Quickens", pipelineValue: 40000000, lockedValue: 40000000, realizedValue: 0,
    totalPrice: 40000000, toTalent: 20000000, managementFee: 5000000, dppGrossUp: null, taxApplied: true,
    defaultTax: 0.02, customTax: null, taxUsed: 0.02, taxMethod: "Gross Up",
    dateFirstContacted: "2026-03-15", datePitchSent: "2026-03-20", dateVerbalLock: "2026-03-28",
    dateProjectConfirmed: "2026-04-01", dateProjectRealized: "", dateProjectCancelled: "",
    ...blankProjectExtras(),
  },
  {
    id: genProjectId(seedTalents[3].talentCode, "2026-05-15"),
    createdBy: "u3",
    partnershipPIC: "Bagas Partnership", legalPIC: "", financePIC: "", pmPIC: "",
    dateInserted: "2026-05-15", dateUpdated: "2026-06-02",
    name: "UrbanFit Apparel Collab", prospectiveClient: "UrbanFit", prospectiveBrand: "UrbanFit",
    brandName: "UrbanFit", companyName: "PT UrbanFit Apparel", agencyName: "-",
    picName: "Dedy Kusuma", picPosition: "Marketing Manager", picWhatsapp: "0819xxxxxxx", picEmail: "dedy@urbanfit.id",
    leadSource: "Inbound", clientStatus: "Lost Client", projectSource: "Direct Brand",
    talentIds: [seedTalents[3].id], sow: "1 IG Reels + 1 TikTok Video", expectedTimeline: "2 weeks",
    projectStatus: "Lost", pipelineStage: "Lost", topAgreement: "", notes: "Budget cut before verbal lock",
    groupName: "UrbanFit x Quickens", pipelineValue: 9000000, lockedValue: 0, realizedValue: 0,
    totalPrice: 9000000, toTalent: 6000000, managementFee: 1500000, dppGrossUp: null, taxApplied: true,
    defaultTax: 0.05, customTax: null, taxUsed: 0.05, taxMethod: "Gross Up",
    dateFirstContacted: "2026-05-15", datePitchSent: "2026-05-18", dateVerbalLock: "",
    dateProjectConfirmed: "", dateProjectRealized: "", dateProjectCancelled: "2026-06-02",
    ...blankProjectExtras(),
  },
  {
    id: genProjectId(seedTalents[2].talentCode, "2026-02-10"),
    createdBy: "u2",
    partnershipPIC: "Dinda Partnership", legalPIC: "Yusuf Legal", financePIC: "Sari Finance", pmPIC: "Fajar PM",
    dateInserted: "2026-02-10", dateUpdated: "2026-04-05",
    name: "Kirana Ramadhan Hampers", prospectiveClient: "Kirana Retail", prospectiveBrand: "Kirana Retail",
    brandName: "Kirana Retail", companyName: "PT Kirana Retail Nusantara", agencyName: "-",
    picName: "Fitri Handayani", picPosition: "Brand Manager", picWhatsapp: "0838xxxxxxx", picEmail: "fitri@kiranaretail.id",
    leadSource: "Referral", clientStatus: "Existing Client", projectSource: "Direct Brand",
    talentIds: [seedTalents[2].id], sow: "1 IG Reels + 1 IG Story", expectedTimeline: "2 weeks",
    projectStatus: "Realized", pipelineStage: "Realized", topAgreement: "14 days after invoice", notes: "Ramadhan hampers campaign, closed out",
    groupName: "Kirana Retail x Quickens", pipelineValue: 15000000, lockedValue: 15000000, realizedValue: 15000000,
    totalPrice: 15000000, toTalent: 10000000, managementFee: 2000000, dppGrossUp: null, taxApplied: true,
    defaultTax: 0.02, customTax: null, taxUsed: 0.02, taxMethod: "Gross Up",
    dateFirstContacted: "2026-02-01", datePitchSent: "2026-02-05", dateVerbalLock: "2026-02-08",
    dateProjectConfirmed: "2026-02-10", dateProjectRealized: "2026-07-01", dateProjectCancelled: "",
    ...blankProjectExtras(),
  },
  {
    // Freshly locked this month — gives the "this month" secured figures on the
    // Dashboard something real to show. Sub-records intentionally left blank,
    // same pattern as the other non-featured seed projects.
    id: genProjectId(seedTalents[1].talentCode, "2026-06-25"),
    createdBy: "u3",
    partnershipPIC: "Bagas Partnership", legalPIC: "Yusuf Legal", financePIC: "Sari Finance", pmPIC: "Fajar PM",
    dateInserted: "2026-06-25", dateUpdated: "2026-07-04",
    name: "Sunrise Skincare Serum Bundle", prospectiveClient: "Sunrise Skincare", prospectiveBrand: "Sunrise",
    brandName: "Sunrise", companyName: "PT Sunrise Skincare Indonesia", agencyName: "-",
    picName: "Melati Putri", picPosition: "Brand Manager", picWhatsapp: "0857xxxxxxx", picEmail: "melati@sunriseskincare.id",
    leadSource: "Referral", clientStatus: "Confirmed Client", projectSource: "Direct Brand",
    talentIds: [seedTalents[1].id], sow: "2 IG Reels + 1 TikTok Video", expectedTimeline: "3 weeks",
    projectStatus: "Confirmed", pipelineStage: "Confirmed", topAgreement: "14 days after invoice", notes: "Locked this month",
    groupName: "Sunrise x Quickens", pipelineValue: 20000000, lockedValue: 20000000, realizedValue: 0,
    totalPrice: 20000000, toTalent: 13000000, managementFee: 3000000, dppGrossUp: null, taxApplied: true,
    defaultTax: 0.025, customTax: null, taxUsed: 0.025, taxMethod: "Gross Up",
    dateFirstContacted: "2026-06-20", datePitchSent: "2026-06-22", dateVerbalLock: "2026-07-03",
    dateProjectConfirmed: "2026-07-04", dateProjectRealized: "", dateProjectCancelled: "",
    ...blankProjectExtras(),
  },
  {
    // Brand-new inbound lead this month — populates "this month" pipeline value.
    id: genProjectId(null, "2026-07-05"),
    createdBy: "u2",
    partnershipPIC: "Dinda Partnership", legalPIC: "", financePIC: "", pmPIC: "",
    dateInserted: "2026-07-05", dateUpdated: "2026-07-05",
    name: "Velora Beauty Awareness Campaign", prospectiveClient: "Velora Beauty", prospectiveBrand: "Velora",
    brandName: "Velora", companyName: "PT Velora Beauty", agencyName: "-",
    picName: "Intan Maharani", picPosition: "Marketing Manager", picWhatsapp: "0878xxxxxxx", picEmail: "intan@velorabeauty.id",
    leadSource: "Inbound", clientStatus: "New Prospect", projectSource: "Direct Brand",
    talentIds: [], sow: "TBD", expectedTimeline: "TBD",
    projectStatus: "New Inquiry", pipelineStage: "New Lead", topAgreement: "", notes: "First call scheduled",
    groupName: "", pipelineValue: 8000000, lockedValue: 0, realizedValue: 0,
    totalPrice: 0, toTalent: 0, managementFee: 0, dppGrossUp: null, taxApplied: false,
    defaultTax: 0, customTax: null, taxUsed: 0, taxMethod: "No Tax",
    dateFirstContacted: "2026-07-05", datePitchSent: "", dateVerbalLock: "",
    dateProjectConfirmed: "", dateProjectRealized: "", dateProjectCancelled: "",
    ...blankProjectExtras(),
  },
];

// Attach legal / finance / pm sub-records to the already-confirmed seed projects.
seedProjects[0].lockedSOWDetails = "1x IG Reels (up to 60s, no voiceover)\n3x IG Story (product highlight + swipe up)\n1x Usage rights 30 days";
seedProjects[0].oversightPICName = "Rani Admin";
seedProjects[0].oversightPICWhatsapp = "0821-1000-0001";
seedProjects[0].valueAdjustmentNotes = "Locked at original pipeline estimate — no renegotiation needed.";
seedProjects[0].legal = {
  agreementIssuer: "Quickens Agency", namaPerusahaan: "PT Glowlight Indonesia", alamatPerusahaan: "Jakarta Selatan",
  namaPenanggungJawab: "Anisa Rahma", jabatan: "Brand Manager", spkFileName: "SPK_Glowlight_Serum.pdf",
  spkLink: "https://drive.example.com/spk-glowlight", spkDueDate: "2026-07-05", legalNotes: "Waiting final signature",
  legalStatus: "Waiting Signature", lastEditLegal: "2026-06-20",
};
seedProjects[0].finance = {
  invoiceNumber: "INV-2026-0512", invoiceAttachment: "", invoicingDate: "2026-06-15", paymentDueDate: "2026-06-29",
  paidByClient: false, buktiBayarName: "", buktiBayarAttachment: "", buktiPotongPajak: "", sudahFollowUp: true,
  statusRebateKOL: "Pending", financeNotes: "Followed up via WA on 25 Jun", financeStatus: "Waiting Payment",
  lastEditFinance: "2026-06-25", paymentSuccess: false,
};
seedProjects[0].pm = {
  idHelper: "GLW-01", productReceived: "Yes", brief: "Sent", briefNotes: "Brief sent 3 Jun",
  storylineRequired: "Yes", storylineStatus: "Approved", storylineNotes: "Approved by brand 8 Jun",
  storylineLink: "https://drive.example.com/storyline-glowlight", storylineDueDate: "2026-06-08",
  progress: "Content Production", needAction: false, notesProject: "On track",
  estimatedExecutionDate: "2026-06-18", estimatedPostingDueDate: "2026-06-22", contentSubmissionDueDate: "2026-06-19",
  brandApprovalDueDate: "2026-06-21", finalPostingDate: "", dateProjectDeliver: "", timelineNotes: "",
  lastEditedPM: "2026-06-20",
};
seedProjects[0].deliverables = [
  { id: genId("deliverable"), projectId: seedProjects[0].id, talentId: seedTalents[0].id, type: "IG Reels", description: "Serum unboxing reels", dueDate: "2026-06-22", draftDate: "2026-06-19", revisionDeadline: "2026-06-20", approvalDate: "2026-06-21", postingDate: "", postedLink: "", reportLink: "", status: "In Progress", notes: "" },
  { id: genId("deliverable"), projectId: seedProjects[0].id, talentId: seedTalents[0].id, type: "IG Story", description: "3x story series", dueDate: "2026-06-23", draftDate: "", revisionDeadline: "", approvalDate: "", postingDate: "", postedLink: "", reportLink: "", status: "Waiting Brief", notes: "" },
];
seedProjects[0].documents = [
  { id: genId("document"), projectId: seedProjects[0].id, type: "SPK", name: "SPK_Glowlight_Serum.pdf", link: "https://drive.example.com/spk-glowlight", uploadedBy: "Yusuf Legal", uploadedAt: "2026-06-10", notes: "" },
];

seedProjects[2].lockedSOWDetails = "1x Livestream (60 minutes, Ramadhan Food Festival)\n2x IG Reels recap (up to 30s each)";
seedProjects[2].oversightPICName = "Rani Admin";
seedProjects[2].oversightPICWhatsapp = "0821-1000-0001";
seedProjects[2].valueAdjustmentNotes = "Locked value renegotiated up from initial pipeline estimate after client added the livestream extension.";
seedProjects[2].legal = {
  agreementIssuer: "Quickens Agency", namaPerusahaan: "PT Rasa Nusantara Group", alamatPerusahaan: "Bandung",
  namaPenanggungJawab: "Wulan Sari", jabatan: "Head of Marketing", spkFileName: "SPK_RasaNusantara.pdf",
  spkLink: "https://drive.example.com/spk-rasa", spkDueDate: "2026-06-25", legalNotes: "",
  legalStatus: "Signed", lastEditLegal: "2026-06-05",
};
seedProjects[2].finance = {
  invoiceNumber: "INV-2026-0480", invoiceAttachment: "", invoicingDate: "2026-04-10", paymentDueDate: "2026-04-24",
  paidByClient: true, buktiBayarName: "Bukti Transfer Rasa Nusantara", buktiBayarAttachment: "", buktiPotongPajak: "Bukti_Potong_Rasa.pdf",
  sudahFollowUp: true, statusRebateKOL: "Paid", financeNotes: "Client paid on time", financeStatus: "Talent Paid",
  lastEditFinance: "2026-05-02", paymentSuccess: true,
};
seedProjects[2].pm = {
  idHelper: "RNF-01", productReceived: "Yes", brief: "Sent", briefNotes: "",
  storylineRequired: "Yes", storylineStatus: "Approved", storylineNotes: "",
  storylineLink: "https://drive.example.com/storyline-rasa", storylineDueDate: "2026-04-20",
  progress: "Reported", needAction: false, notesProject: "Successful livestream, report submitted",
  estimatedExecutionDate: "2026-04-28", estimatedPostingDueDate: "2026-04-30", contentSubmissionDueDate: "2026-04-29",
  brandApprovalDueDate: "2026-04-29", finalPostingDate: "2026-04-30", dateProjectDeliver: "2026-05-05", timelineNotes: "",
  lastEditedPM: "2026-05-05",
};
seedProjects[2].deliverables = [
  { id: genId("deliverable"), projectId: seedProjects[2].id, talentId: seedTalents[2].id, type: "Livestream", description: "Food festival livestream", dueDate: "2026-04-30", draftDate: "", revisionDeadline: "", approvalDate: "2026-04-29", postingDate: "2026-04-30", postedLink: "https://instagram.com/live/rasa", reportLink: "https://drive.example.com/report-rasa", status: "Completed", notes: "" },
];
seedProjects[2].documents = [
  { id: genId("document"), projectId: seedProjects[2].id, type: "Invoice", name: "INV-2026-0480.pdf", link: "https://drive.example.com/invoice-rasa", uploadedBy: "Sari Finance", uploadedAt: "2026-04-10", notes: "" },
];

const seedLogs = [
  { id: genId("log"), projectId: seedProjects[0].id, user: "Dinda Partnership", role: "partnership", action: "Created project", module: "Partnership", field: "", oldValue: "", newValue: "", timestamp: "2026-05-02T09:00:00" },
  { id: genId("log"), projectId: seedProjects[0].id, user: "Dinda Partnership", role: "partnership", action: "Pipeline stage changed", module: "Partnership", field: "pipelineStage", oldValue: "Verbal Lock", newValue: "Confirmed", timestamp: "2026-05-02T09:10:00" },
  { id: genId("log"), projectId: seedProjects[0].id, user: "Yusuf Legal", role: "legal", action: "Legal status changed", module: "Legal", field: "legalStatus", oldValue: "Drafting SPK", newValue: "Waiting Signature", timestamp: "2026-06-20T14:00:00" },
  { id: genId("log"), projectId: seedProjects[2].id, user: "Sari Finance", role: "finance", action: "Payment status changed", module: "Finance", field: "financeStatus", oldValue: "Waiting Payment", newValue: "Paid by Client", timestamp: "2026-04-24T11:00:00" },
];

// ---------------------------------------------------------------------------
// SMALL UI PRIMITIVES
// ---------------------------------------------------------------------------
function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 pt-6 backdrop-blur-sm sm:p-6">
      <div className={`w-full ${wide ? "max-w-5xl" : "max-w-xl"} overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl shadow-slate-900/20`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">Quickens OS</p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, span }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm shadow-slate-100/50 transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const selectCls = inputCls;
const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100";
const btnSecondary = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100";

function Select({ value, onChange, options, ...rest }) {
  return (
    <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-3.5 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/70">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${accent || "text-slate-900"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs leading-snug text-slate-400">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold tracking-tight text-slate-800">{children}</h2>
      {right}
    </div>
  );
}

function Th({ children, className, ...props }) {
  return <th className={`whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 ${className || ""}`} {...props}>{children}</th>;
}
function Td({ children, className, ...props }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-sm text-slate-700 ${className || ""}`} {...props}>{children}</td>;
}

// ---------------------------------------------------------------------------
// MAIN APP
// ---------------------------------------------------------------------------
export default function App() {
  const [users] = useState(seedUsers);
  const [currentUserId, setCurrentUserId] = useState("u2");
  const currentUser = users.find((u) => u.id === currentUserId);

  const [talents, setTalents] = useState(seedTalents);
  const [projects, setProjects] = useState(seedProjects);
  const [logs, setLogs] = useState(seedLogs);

  const [view, setView] = useState("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedTalentId, setSelectedTalentId] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [talentModalOpen, setTalentModalOpen] = useState(false);
  const [editingTalent, setEditingTalent] = useState(null);
  const [templates, setTemplates] = useState({ brand: DEFAULT_BRAND_TEMPLATE, talent: DEFAULT_TALENT_TEMPLATE });
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const role = currentUser.role;

  // -------------------------------------------------------------------
  // ACTIVITY LOG
  // -------------------------------------------------------------------
  function logActivity(projectId, action, module, field, oldValue, newValue) {
    setLogs((prev) => [
      { id: genId("log"), projectId, user: currentUser.name, role: currentUser.role, action, module, field, oldValue: oldValue ?? "", newValue: newValue ?? "", timestamp: new Date().toISOString() },
      ...prev,
    ]);
  }

  // -------------------------------------------------------------------
  // PROJECT CRUD + AUTOMATION
  // -------------------------------------------------------------------
  function createProject(form) {
    const primaryTalent = talents.find((t) => t.id === form.talentIds?.[0]);
    const id = genProjectId(primaryTalent?.talentCode);
    const project = {
      id,
      createdBy: currentUser.id,
      partnershipPIC: currentUser.name, legalPIC: form.legalPIC || "", financePIC: form.financePIC || "", pmPIC: form.pmPIC || "",
      dateInserted: today(), dateUpdated: today(),
      name: form.name, prospectiveClient: form.prospectiveClient, prospectiveBrand: form.brandName,
      brandName: form.brandName, companyName: form.companyName, agencyName: form.agencyName,
      picName: form.picName, picPosition: form.picPosition, picWhatsapp: form.picWhatsapp, picEmail: form.picEmail,
      leadSource: form.leadSource, clientStatus: form.clientStatus, projectSource: form.projectSource,
      talentIds: form.talentIds, sow: form.sow, expectedTimeline: form.expectedTimeline,
      projectStatus: form.projectStatus, pipelineStage: form.pipelineStage, topAgreement: form.topAgreement,
      notes: form.notes, groupName: form.groupName,
      pipelineValue: Number(form.pipelineValue) || 0, lockedValue: 0, realizedValue: 0,
      totalPrice: Number(form.totalPrice) || 0, toTalent: Number(form.toTalent) || 0, managementFee: Number(form.managementFee) || 0,
      dppGrossUp: null, taxApplied: true, defaultTax: form.defaultTax, customTax: form.customTax || null,
      taxUsed: form.customTax ? Number(form.customTax) : Number(form.defaultTax) || 0, taxMethod: form.taxMethod || "Gross Up",
      dateFirstContacted: today(), datePitchSent: "", dateVerbalLock: "", dateProjectConfirmed: "", dateProjectRealized: "", dateProjectCancelled: "",
      ...blankProjectExtras(),
    };
    if (LOCKED_STAGES.includes(project.pipelineStage)) project.lockedValue = project.pipelineValue;
    setProjects((prev) => [project, ...prev]);
    logActivity(id, "Created project", "Partnership", "", "", form.name);
    logActivity(id, "Pipeline Estimated Value created", "Partnership", "pipelineValue", "", fmtIDR(project.pipelineValue));
    setProjectModalOpen(false);
    setSelectedProjectId(id);
    setView("projectDetail");
  }

  function updateProject(id, patch, moduleName = "Partnership") {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        let next = { ...p, ...patch, dateUpdated: today() };

        const skipLogFields = new Set(["legal","finance","pm","deliverables","documents","brandConfirmationMessage","talentConfirmationMessage","dateUpdated"]);
        Object.keys(patch).forEach((k) => {
          if (skipLogFields.has(k)) return;
          const oldV = JSON.stringify(p[k]);
          const newV = JSON.stringify(patch[k]);
          if (oldV !== newV) {
            const label = FIELD_LABELS[k] || k;
            logActivity(id, `${label} changed`, moduleName, k, String(p[k]), String(patch[k]));
          }
        });

        // Auto date logic
        if (patch.pipelineStage && patch.pipelineStage !== p.pipelineStage) {
          if (patch.pipelineStage === "Verbal Lock" && !next.dateVerbalLock) next.dateVerbalLock = today();
          if (LOCKED_STAGES.includes(patch.pipelineStage)) next.lockedValue = next.pipelineValue;
        }
        if (patch.projectStatus && patch.projectStatus !== p.projectStatus) {
          if (patch.projectStatus === "Confirmed" && !next.dateProjectConfirmed) next.dateProjectConfirmed = today();
          if ((patch.projectStatus === "Realized" || patch.projectStatus === "Completed") && !next.dateProjectRealized) {
            next.dateProjectRealized = today();
            next.realizedValue = next.lockedValue || next.pipelineValue;
          }
          if (patch.projectStatus === "Cancelled" || patch.projectStatus === "Lost") next.dateProjectCancelled = today();

          // Auto-create Legal / Finance / PM records on confirmation
          if (CONFIRMED_STATUSES.includes(patch.projectStatus)) {
            if (!next.legal) next.legal = {
              agreementIssuer: "Quickens Agency", namaPerusahaan: next.companyName, alamatPerusahaan: "", namaPenanggungJawab: next.picName,
              jabatan: next.picPosition, spkFileName: "", spkLink: "", spkDueDate: "", legalNotes: "", legalStatus: "Not Started", lastEditLegal: today(),
            };
            if (!next.finance) next.finance = {
              invoiceNumber: "", invoiceAttachment: "", invoicingDate: "", paymentDueDate: "", paidByClient: false,
              buktiBayarName: "", buktiBayarAttachment: "", buktiPotongPajak: "", sudahFollowUp: false, statusRebateKOL: "Pending",
              financeNotes: "", financeStatus: "Not Invoiced", lastEditFinance: today(), paymentSuccess: false,
            };
            if (!next.pm) next.pm = {
              idHelper: "", productReceived: "No", brief: "Not Sent", briefNotes: "", storylineRequired: "To Be Confirmed",
              storylineStatus: "Not Needed", storylineNotes: "", storylineLink: "", storylineDueDate: "", progress: "Waiting Brief",
              needAction: false, notesProject: "", estimatedExecutionDate: "", estimatedPostingDueDate: "", contentSubmissionDueDate: "",
              brandApprovalDueDate: "", finalPostingDate: "", dateProjectDeliver: "", timelineNotes: "", lastEditedPM: today(),
            };
          }
        }
        return next;
      })
    );
  }

  function updateSubRecord(projectId, key, patch, moduleName) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        const oldSub = p[key] || {};
        Object.keys(patch).forEach((k) => {
          if (oldSub[k] !== patch[k]) logActivity(projectId, `${k} changed`, moduleName, k, String(oldSub[k]), String(patch[k]));
        });
        const stampField = key === "legal" ? "lastEditLegal" : key === "finance" ? "lastEditFinance" : "lastEditedPM";
        return { ...p, [key]: { ...oldSub, ...patch, [stampField]: today() }, dateUpdated: today() };
      })
    );
  }

  function addDeliverable(projectId, form) {
    const d = { id: genId("deliverable"), projectId, ...form };
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, deliverables: [...p.deliverables, d] } : p)));
    logActivity(projectId, "Deliverable added", "PM / Deliverables", "", "", form.description);
  }
  function updateDeliverable(projectId, deliverableId, patch) {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          deliverables: p.deliverables.map((d) => {
            if (d.id !== deliverableId) return d;
            if (patch.status && patch.status !== d.status) logActivity(projectId, "Deliverable status changed", "PM / Deliverables", "status", d.status, patch.status);
            return { ...d, ...patch };
          }),
        };
      })
    );
  }
  function addDocument(projectId, form) {
    const d = { id: genId("document"), projectId, uploadedBy: currentUser.name, uploadedAt: today(), ...form };
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, documents: [...p.documents, d] } : p)));
    logActivity(projectId, "Document uploaded", "Documents", "", "", form.name);
  }
  function saveBrandConfirmation(projectId, message) {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, brandConfirmationMessage: message } : p)));
    logActivity(projectId, "Brand confirmation edited", "Client & Project Confirmation", "brandConfirmationMessage", "", "message saved");
  }
  function saveTalentConfirmation(projectId, message) {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, talentConfirmationMessage: message } : p)));
    logActivity(projectId, "Talent confirmation edited", "Client & Project Confirmation", "talentConfirmationMessage", "", "message saved");
  }
  function logConfirmationGenerated(projectId, kind) {
    logActivity(projectId, `${kind} confirmation generated`, "Client & Project Confirmation", "", "", "regenerated from template");
  }
  function updateTemplates(kind, text) {
    setTemplates((prev) => ({ ...prev, [kind]: text }));
    logActivity(null, `Default ${kind === "brand" ? "Brand" : "Talent"} Confirmation template updated`, "Template Settings", kind, "", "template edited");
    setTemplateModalOpen(false);
  }

  // -------------------------------------------------------------------
  // TALENT CRUD
  // -------------------------------------------------------------------
  function saveTalent(form, existingId) {
    if (existingId) {
      setTalents((prev) => prev.map((t) => (t.id === existingId ? { ...t, ...form, updatedBy: currentUser.name, updatedAt: today() } : t)));
    } else {
      const t = { id: genId("talent"), ...form, createdBy: currentUser.name, updatedBy: currentUser.name, createdAt: today(), updatedAt: today() };
      setTalents((prev) => [t, ...prev]);
    }
    setTalentModalOpen(false);
    setEditingTalent(null);
  }

  // -------------------------------------------------------------------
  // DERIVED DATA
  // -------------------------------------------------------------------
  const clients = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => {
      const key = p.companyName || p.brandName;
      if (!map.has(key)) {
        map.set(key, {
          key, brandName: p.brandName, companyName: p.companyName, agencyName: p.agencyName,
          picName: p.picName, picPosition: p.picPosition, picWhatsapp: p.picWhatsapp, picEmail: p.picEmail,
          clientStatus: p.clientStatus, partnershipPIC: p.partnershipPIC, projects: [], notes: p.notes,
          pipelineValue: 0, lockedValue: 0, realizedValue: 0, lastContacted: p.dateFirstContacted,
        });
      }
      const c = map.get(key);
      c.projects.push({ id: p.id, name: p.name, status: p.projectStatus });
      c.pipelineValue += p.pipelineValue;
      c.lockedValue += p.lockedValue;
      c.realizedValue += p.realizedValue;
      c.clientStatus = p.clientStatus;
      if (new Date(p.dateFirstContacted) > new Date(c.lastContacted)) c.lastContacted = p.dateFirstContacted;
    });
    return Array.from(map.values());
  }, [projects]);

  // Value/status aggregation for the Dashboard now lives in the chart
  // components themselves (see DASHBOARD section below) so each role's view
  // always reflects the live projects/talents state without duplicating
  // summary logic here and in the Partnership Logbook.

  // A project is editable in the Partnership Logbook by Admin/Management,
  // or by the Partnership user who personally created it. Legal/Finance/PM
  // tabs have their own separate role gates further down.
  function canEditProject(project) {
    if (role === "admin") return true;
    if (role === "partnership") return project.createdBy === currentUser.id;
    return false;
  }

  // -------------------------------------------------------------------
  // NAV
  // -------------------------------------------------------------------
  const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin","partnership","legal","finance","pm"] },
    { key: "partnership", label: "Partnership Logbook", icon: Handshake, roles: ["admin","partnership"] },
    { key: "clients", label: "Client Database", icon: Building2, roles: ["admin","partnership"] },
    { key: "talents", label: "Talent Database", icon: Users, roles: ["admin","partnership"] },
    { key: "legal", label: "Legal Tracker", icon: Scale, roles: ["admin","legal"] },
    { key: "finance", label: "Finance Tracker", icon: Wallet, roles: ["admin","finance"] },
    { key: "pm", label: "PM Tracker", icon: ClipboardList, roles: ["admin","pm"] },
    { key: "deliverables", label: "Deliverables", icon: PackageCheck, roles: ["admin","pm"] },
    { key: "documents", label: "Documents", icon: FileText, roles: ["admin","partnership","legal","finance","pm"] },
    { key: "activity", label: "Activity Logs", icon: History, roles: ["admin"] },
  ].filter((n) => n.roles.includes(role));

  function go(v, projectId) {
    setView(v);
    if (projectId) setSelectedProjectId(projectId);
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedTalent = talents.find((t) => t.id === selectedTalentId);

  return (
    <div className="flex h-full min-h-screen w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 text-slate-800" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* SIDEBAR */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
            <Briefcase size={18} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-slate-900">Quickens</p>
            <p className="text-[11px] font-medium leading-tight text-slate-400">Talent Management OS</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.key || (n.key === "partnership" && view === "projectDetail") || (n.key === "talents" && view === "talentDetail");
            return (
              <button
                key={n.key}
                onClick={() => go(n.key)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon size={16} /> {n.label}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 bg-slate-50/70 p-3">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Demo role switch</label>
          <select
            className={selectCls + " text-xs"}
            value={currentUserId}
            onChange={(e) => { setCurrentUserId(e.target.value); setView("dashboard"); }}
          >
            {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {ROLES[u.role]}</option>)}
          </select>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1500px] px-5 py-5 lg:px-7 lg:py-7">
          {view === "dashboard" && <DashboardView role={role} currentUser={currentUser} projects={projects} talents={talents} clients={clients} onOpenProject={(id) => go("projectDetail", id)} />}

          {view === "partnership" && (
            <PartnershipLogbookView
              projects={projects} search={search} setSearch={setSearch}
              onCreate={() => setProjectModalOpen(true)}
              onOpen={(id) => go("projectDetail", id)}
              canCreate={role === "admin" || role === "partnership"}
              role={role} currentUser={currentUser}
              canEditProject={canEditProject}
            />
          )}

          {view === "projectDetail" && selectedProject && (
            <ProjectDetailView
              project={selectedProject} talents={talents} role={role} currentUser={currentUser} users={users}
              logs={logs.filter((l) => l.projectId === selectedProject.id)}
              canEditProject={canEditProject}
              templates={templates}
              onBack={() => go("partnership")}
              onUpdateProject={(patch, mod) => updateProject(selectedProject.id, patch, mod)}
              onUpdateSub={(key, patch, mod) => updateSubRecord(selectedProject.id, key, patch, mod)}
              onAddDeliverable={(form) => addDeliverable(selectedProject.id, form)}
              onUpdateDeliverable={(dId, patch) => updateDeliverable(selectedProject.id, dId, patch)}
              onAddDocument={(form) => addDocument(selectedProject.id, form)}
              onSaveBrand={(msg) => saveBrandConfirmation(selectedProject.id, msg)}
              onSaveTalent={(msg) => saveTalentConfirmation(selectedProject.id, msg)}
              onLogGenerate={(kind) => logConfirmationGenerated(selectedProject.id, kind)}
              onOpenTemplateSettings={() => setTemplateModalOpen(true)}
            />
          )}

          {view === "clients" && <ClientDatabaseView clients={clients} onOpenProject={(id) => go("projectDetail", id)} />}

          {view === "talents" && (
            <TalentDatabaseView
              talents={talents}
              onCreate={() => { setEditingTalent(null); setTalentModalOpen(true); }}
              onEdit={(t) => { setEditingTalent(t); setTalentModalOpen(true); }}
              onOpen={(id) => { setSelectedTalentId(id); setView("talentDetail"); }}
            />
          )}

          {view === "talentDetail" && selectedTalent && (
            <TalentDetailView
              talent={selectedTalent}
              onBack={() => setView("talents")}
              onEdit={() => { setEditingTalent(selectedTalent); setTalentModalOpen(true); }}
            />
          )}

          {view === "legal" && <LegalTrackerView projects={projects.filter((p) => p.legal)} role={role} onOpen={(id) => go("projectDetail", id)} onUpdate={(id, patch) => updateSubRecord(id, "legal", patch, "Legal")} />}

          {view === "finance" && <FinanceTrackerView projects={projects.filter((p) => p.finance)} role={role} onOpen={(id) => go("projectDetail", id)} onUpdate={(id, patch) => updateSubRecord(id, "finance", patch, "Finance")} />}

          {view === "pm" && <PMTrackerView projects={projects.filter((p) => p.pm)} role={role} onOpen={(id) => go("projectDetail", id)} onUpdate={(id, patch) => updateSubRecord(id, "pm", patch, "PM / Deliverables")} />}

          {view === "deliverables" && <DeliverablesView projects={projects} talents={talents} onUpdate={(pid, did, patch) => updateDeliverable(pid, did, patch)} onOpen={(id) => go("projectDetail", id)} />}

          {view === "documents" && <DocumentsView projects={projects} onOpen={(id) => go("projectDetail", id)} />}

          {view === "activity" && <ActivityLogsView logs={logs} projects={projects} />}
        </div>
      </main>

      <ProjectFormModal open={projectModalOpen} onClose={() => setProjectModalOpen(false)} talents={talents} onSave={createProject} />
      <TalentFormModal open={talentModalOpen} onClose={() => { setTalentModalOpen(false); setEditingTalent(null); }} onSave={saveTalent} existing={editingTalent} />
      <TemplateSettingsModal open={templateModalOpen} onClose={() => setTemplateModalOpen(false)} templates={templates} onSave={updateTemplates} />
    </div>
  );
}

/* =========================================================================
   DASHBOARD — data aggregation helpers
   All pure functions over a `projects` array so "my numbers" (filtered list)
   and "team numbers" (full list) always share the exact same math.
   ========================================================================= */
function outstandingPayment(list) {
  return list.filter((p) => p.finance && !p.finance.paidByClient).reduce((s, p) => s + (p.totalPrice || 0), 0);
}

const STATUS_BUCKET_MAP = {
  "New Inquiry": "New Lead",
  "Pitching": "Pitching", "Negotiation": "Negotiation", "Verbal Lock": "Verbal Lock",
  "Confirmed": "Confirmed", "On Going": "On Going",
  "Completed": "Completed", "Realized": "Completed",
  "Lost": "Lost", "Cancelled": "Cancelled", "On Hold": "Cancelled",
};
const STATUS_BUCKET_ORDER = ["New Lead", "Pitching", "Negotiation", "Verbal Lock", "Confirmed", "On Going", "Completed", "Lost", "Cancelled"];
function statusDistribution(list) {
  const counts = {};
  list.forEach((p) => { const b = STATUS_BUCKET_MAP[p.projectStatus] || p.projectStatus; counts[b] = (counts[b] || 0) + 1; });
  return STATUS_BUCKET_ORDER.filter((s) => counts[s]).map((s) => ({ name: s, value: counts[s] }));
}

const FUNNEL_STAGES = ["New Lead", "Contacted", "Pitching", "Negotiation", "Verbal Lock", "Confirmed", "Realized"];
function funnelData(list) {
  return FUNNEL_STAGES.map((s) => ({ name: s, count: list.filter((p) => p.pipelineStage === s).length }));
}

function monthKey(d) { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(key) { const [y, m] = key.split("-"); return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }); }
function monthlyTrend(list) {
  const map = {};
  list.forEach((p) => {
    if (!p.dateInserted) return;
    const k = monthKey(p.dateInserted);
    if (!map[k]) map[k] = { pipeline: 0, secured: 0, realized: 0 };
    map[k].pipeline += p.pipelineValue;
    map[k].secured += p.lockedValue;
    map[k].realized += p.realizedValue;
  });
  return Object.keys(map).sort().map((k) => ({ month: monthLabel(k), ...map[k] }));
}

function picPerformance(list) {
  const map = {};
  list.forEach((p) => {
    if (!map[p.partnershipPIC]) map[p.partnershipPIC] = { name: p.partnershipPIC, pipeline: 0, secured: 0, realized: 0 };
    map[p.partnershipPIC].pipeline += p.pipelineValue;
    map[p.partnershipPIC].secured += p.lockedValue;
    map[p.partnershipPIC].realized += p.realizedValue;
  });
  return Object.values(map);
}

function pmWorkload(list) {
  const map = {};
  list.forEach((p) => {
    if (!p.pm || !p.pmPIC) return;
    if (!(p.pmPIC in map)) map[p.pmPIC] = 0;
    if (!["Completed", "Posted", "Reported"].includes(p.pm.progress)) map[p.pmPIC] += 1;
  });
  return Object.entries(map).map(([name, count]) => ({ name, count }));
}
function legalWorkload(list) {
  const map = {};
  list.forEach((p) => {
    if (!p.legal || !p.legalPIC) return;
    if (!(p.legalPIC in map)) map[p.legalPIC] = 0;
    if (!["Completed", "Signed"].includes(p.legal.legalStatus)) map[p.legalPIC] += 1;
  });
  return Object.entries(map).map(([name, count]) => ({ name, count }));
}

function legalFinanceCards(list) {
  return {
    overdueSPK: list.filter((p) => p.legal && isPast(p.legal.spkDueDate) && !["Completed", "Signed"].includes(p.legal.legalStatus)).length,
    waitingSignature: list.filter((p) => p.legal && p.legal.legalStatus === "Waiting Signature").length,
    unpaidInvoice: list.filter((p) => p.finance && !p.finance.paidByClient && p.finance.financeStatus !== "Not Invoiced").length,
    overduePayment: list.filter((p) => p.finance && isPast(p.finance.paymentDueDate) && !p.finance.paidByClient).length,
    talentPaymentPending: list.filter((p) => p.finance && p.finance.financeStatus === "Talent Payment Pending").length,
    taxDocumentPending: list.filter((p) => p.finance && p.finance.financeStatus === "Tax Document Pending").length,
  };
}

function deliverableStats(list) {
  const all = [];
  list.forEach((p) => p.deliverables.forEach((d) => all.push(d)));
  const byStatus = {};
  all.forEach((d) => { byStatus[d.status] = (byStatus[d.status] || 0) + 1; });
  const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  const in7d = new Date(Date.now() + 7 * 86400000);
  const upcoming = all.filter((d) => d.dueDate && !isPast(d.dueDate) && new Date(d.dueDate) <= in7d && !["Posted", "Completed", "Cancelled"].includes(d.status)).length;
  const overdue = all.filter((d) => isPast(d.dueDate) && !["Posted", "Completed", "Cancelled"].includes(d.status)).length;
  return { statusData, upcoming, overdue, total: all.length };
}

function storylineStats(list) {
  return {
    required: list.filter((p) => p.pm && p.pm.storylineRequired === "Yes").length,
    overdue: list.filter((p) => p.pm && p.pm.storylineRequired === "Yes" && isPast(p.pm.storylineDueDate) && p.pm.storylineStatus !== "Approved").length,
  };
}
function postingStats(list) {
  const in7d = new Date(Date.now() + 7 * 86400000);
  return {
    upcoming: list.filter((p) => p.pm && p.pm.estimatedPostingDueDate && !isPast(p.pm.estimatedPostingDueDate) && new Date(p.pm.estimatedPostingDueDate) <= in7d && !["Posted", "Completed"].includes(p.pm.progress)).length,
    overdue: list.filter((p) => p.pm && isPast(p.pm.estimatedPostingDueDate) && !["Posted", "Completed"].includes(p.pm.progress)).length,
  };
}

// Yearly/monthly Sales Report aggregation (Dashboard §1.2 / §1.3).
// Shared by the Whole Company Sales Report and My Partnership Performance
// sections so both use the exact same date-basis and status rules:
//   pipeline  -> Date Project Inserted (fallback: Date First Contacted), active leads only
//   secured   -> Date Verbal Lock (fallback: Date Project Confirmed), SECURED_STATUSES
//   realized  -> Date Project Realized, REALIZED_STATUSES
function pickDate(p, fields) {
  for (const f of fields) if (p[f]) return p[f];
  return null;
}
function inPeriod(dateStr, year, month) {
  if (!dateStr) return false;
  const dt = new Date(dateStr);
  if (dt.getFullYear() !== year) return false;
  if (month != null && dt.getMonth() !== month) return false;
  return true;
}
function salesReportMetrics(list, { year, month }) {
  let pipelineValue = 0, pipelineCount = 0, securedValue = 0, securedCount = 0, realizedValue = 0, realizedCount = 0;
  list.forEach((p) => {
    if (!ACTIVE_PIPELINE_STATUSES_EXCLUDE.includes(p.projectStatus) && inPeriod(pickDate(p, ["dateInserted", "dateFirstContacted"]), year, month)) {
      pipelineValue += p.pipelineValue;
      pipelineCount += 1;
    }
    if (SECURED_STATUSES.includes(p.projectStatus) && inPeriod(pickDate(p, ["dateVerbalLock", "dateProjectConfirmed"]), year, month)) {
      securedValue += p.lockedValue;
      securedCount += 1;
    }
    if (REALIZED_STATUSES.includes(p.projectStatus) && inPeriod(pickDate(p, ["dateProjectRealized"]), year, month)) {
      realizedValue += p.realizedValue;
      realizedCount += 1;
    }
  });
  return { pipelineValue, pipelineCount, securedValue, securedCount, realizedValue, realizedCount };
}
function achievementPct(actual, target) {
  if (!target) return null;
  return Math.round((actual / target) * 100);
}

/* =========================================================================
   DASHBOARD — chart primitives
   ========================================================================= */
function ChartCard({ title, subtitle, children, right }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs leading-snug text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
function EmptyChart() {
  return <div className="flex h-40 items-center justify-center text-xs text-slate-400">No data yet.</div>;
}
const chartTooltipStyle = { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" };
const axisTick = { fontSize: 11, fill: "#94a3b8" };
const abbrevValue = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}jt` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}rb` : v);

function GroupedBarChart({ data, bars, valueFormatter }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={abbrevValue} />
        <Tooltip formatter={(v) => (valueFormatter ? valueFormatter(v) : v)} contentStyle={chartTooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {bars.map((b) => <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[4, 4, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
function SimpleBarChart({ data, color = "#6366f1" }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
function DonutChart({ data }) {
  if (!data.length) return <EmptyChart />;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2} strokeWidth={0}>
            {data.map((d, i) => <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={chartTooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="w-full flex-1 space-y-1.5">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              {d.name}
            </span>
            <span className="font-medium text-slate-700">{d.value} <span className="text-slate-400">({total ? Math.round((d.value / total) * 100) : 0}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
function TrendLineChart({ data }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={abbrevValue} />
        <Tooltip formatter={(v) => fmtIDR(v)} contentStyle={chartTooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="pipeline" name="Pipeline" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="secured" name="Secured" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="realized" name="Realized" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
function SecuredTrendChart({ data }) {
  if (!data.length) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={abbrevValue} />
        <Tooltip formatter={(v) => fmtIDR(v)} contentStyle={chartTooltipStyle} />
        <Line type="monotone" dataKey="secured" name="Secured Sales" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
function FunnelChart({ stages }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-2">
      {stages.map((s, i) => (
        <div key={s.name} className="flex items-center gap-3">
          <span className="w-24 flex-shrink-0 text-xs text-slate-500">{s.name}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-50">
            <div
              className="flex h-full items-center justify-end rounded-md px-2 text-xs font-medium text-white"
              style={{ width: `${Math.max(s.count ? 8 : 0, (s.count / max) * 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
            >
              {s.count > 0 && s.count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


/* =========================================================================
   DASHBOARD — role-based views
   ========================================================================= */
function DashboardView({ role, currentUser, projects, talents, clients }) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/70 bg-gradient-to-r from-slate-900 via-indigo-900 to-indigo-700 p-5 text-white shadow-lg shadow-indigo-900/10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100/80">Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Welcome back, {currentUser.name}</h1>
        <p className="mt-1 text-sm text-indigo-100/80">{ROLES[role]} · focused view for the work that needs attention today.</p>
      </div>
      {role === "admin" && <AdminDashboard projects={projects} talents={talents} clients={clients} />}
      {role === "partnership" && <PartnershipDashboard projects={projects} currentUser={currentUser} />}
      {role === "legal" && <LegalDashboard projects={projects} currentUser={currentUser} />}
      {role === "finance" && <FinanceDashboard projects={projects} currentUser={currentUser} />}
      {role === "pm" && <PMDashboardView projects={projects} currentUser={currentUser} />}
    </div>
  );
}

const valueBars = [
  { key: "pipeline", label: "Pipeline", color: "#94a3b8" },
  { key: "secured", label: "Secured", color: "#3b82f6" },
  { key: "realized", label: "Realized", color: "#10b981" },
];

function AdminDashboard({ projects, talents, clients }) {
  const kpis = useMemo(() => ({
    pipeline: projects.reduce((s, p) => s + p.pipelineValue, 0),
    secured: projects.reduce((s, p) => s + p.lockedValue, 0),
    realized: projects.reduce((s, p) => s + p.realizedValue, 0),
    active: projects.filter((p) => !["Cancelled", "Lost", "Completed", "Realized"].includes(p.projectStatus)).length,
    confirmed: projects.filter((p) => p.projectStatus === "Confirmed").length,
    outstanding: outstandingPayment(projects),
  }), [projects]);
  const statusData = useMemo(() => statusDistribution(projects), [projects]);
  const trend = useMemo(() => monthlyTrend(projects), [projects]);
  const funnel = useMemo(() => funnelData(projects), [projects]);
  const picPerf = useMemo(() => picPerformance(projects), [projects]);
  const pmWork = useMemo(() => pmWorkload(projects), [projects]);
  const lf = useMemo(() => legalFinanceCards(projects), [projects]);
  const deliv = useMemo(() => deliverableStats(projects), [projects]);
  const story = useMemo(() => storylineStats(projects), [projects]);
  const posting = useMemo(() => postingStats(projects), [projects]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Pipeline Value" value={fmtIDR(kpis.pipeline)} />
        <StatCard label="Total Secured Value" value={fmtIDR(kpis.secured)} accent="text-blue-600" />
        <StatCard label="Total Realized Value" value={fmtIDR(kpis.realized)} accent="text-emerald-600" />
        <StatCard label="Total Active Projects" value={kpis.active} sub={`${talents.length} talents · ${clients.length} clients`} />
        <StatCard label="Total Confirmed Projects" value={kpis.confirmed} accent="text-blue-600" />
        <StatCard label="Total Outstanding Payment" value={fmtIDR(kpis.outstanding)} accent="text-rose-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Partnership Performance" subtitle="Pipeline vs. secured vs. realized value by PIC">
          <GroupedBarChart data={picPerf} bars={valueBars} valueFormatter={fmtIDR} />
        </ChartCard>
        <ChartCard title="Project Status Distribution" subtitle="Current status across all projects">
          <DonutChart data={statusData} />
        </ChartCard>
      </div>

      <ChartCard title="Monthly Value Trend" subtitle="Pipeline, secured, and realized value by month inserted">
        <TrendLineChart data={trend} />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Pipeline Funnel" subtitle="Projects currently at each pipeline stage">
          <FunnelChart stages={funnel} />
        </ChartCard>
        <ChartCard title="PM Workload" subtitle="Active projects per Project Manager">
          <SimpleBarChart data={pmWork} color="#6366f1" />
        </ChartCard>
      </div>

      <ChartCard title="Legal & Finance Status">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Overdue SPK" value={lf.overdueSPK} accent={lf.overdueSPK ? "text-rose-600" : ""} />
          <StatCard label="Waiting Signature" value={lf.waitingSignature} accent="text-blue-600" />
          <StatCard label="Unpaid Invoice" value={lf.unpaidInvoice} accent="text-amber-600" />
          <StatCard label="Overdue Payment" value={lf.overduePayment} accent={lf.overduePayment ? "text-rose-600" : ""} />
          <StatCard label="Talent Payment Pending" value={lf.talentPaymentPending} accent="text-amber-600" />
          <StatCard label="Tax Document Pending" value={lf.taxDocumentPending} accent="text-amber-600" />
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Posting & Storyline">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Upcoming Posting (7d)" value={posting.upcoming} accent="text-blue-600" />
            <StatCard label="Overdue Posting" value={posting.overdue} accent={posting.overdue ? "text-rose-600" : ""} />
            <StatCard label="Requires Storyline" value={story.required} />
            <StatCard label="Overdue Storyline" value={story.overdue} accent={story.overdue ? "text-rose-600" : ""} />
          </div>
        </ChartCard>
        <ChartCard title="Deliverables by Status" subtitle={`${deliv.total} deliverables tracked`}>
          <DonutChart data={deliv.statusData} />
        </ChartCard>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// Six-up stat grid shared by the Yearly and Monthly rows of a Sales Report
// section (Dashboard §1.2 / §1.3) — value + count for pipeline/secured/realized.
function PeriodStatGrid({ label, metrics }) {
  const items = [
    { label: "Pipeline", value: metrics.pipelineValue, count: metrics.pipelineCount, accent: "text-slate-900", hint: "active leads" },
    { label: "Secured", value: metrics.securedValue, count: metrics.securedCount, accent: "text-blue-600", hint: "locked projects" },
    { label: "Realized", value: metrics.realizedValue, count: metrics.realizedCount, accent: "text-emerald-600", hint: "closed projects" },
  ];
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
      <SectionTitle>{label}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{item.label}</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">{item.count} {item.hint}</span>
            </div>
            <p className={`mt-2 text-lg font-bold tracking-tight ${item.accent}`}>{fmtIDR(item.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Secured Project Achievement (Dashboard §1.5) — shows the raw secured count
// always, and only adds a percentage-of-target ring when a target is configured
// (COMPANY_TARGETS / USER_TARGETS). No target set → count only, per spec.
function AchievementBlock({ label, monthly, yearly, targets }) {
  const monthlyPct = targets ? achievementPct(monthly.securedCount, targets.monthlySecuredProjects) : null;
  const yearlyPct = targets ? achievementPct(yearly.securedCount, targets.yearlySecuredProjects) : null;
  const rows = [
    { label: "This Month", count: monthly.securedCount, target: targets?.monthlySecuredProjects, pct: monthlyPct, tone: "bg-blue-500" },
    { label: "This Year", count: yearly.securedCount, target: targets?.yearlySecuredProjects, pct: yearlyPct, tone: "bg-emerald-500" },
  ];
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
      <SectionTitle>{label} Secured Project Achievement</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{row.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{row.count}</p>
              </div>
              <p className="text-right text-xs font-medium text-slate-500">
                {row.pct != null ? `${row.pct}% of target ${row.target}` : "No target set"}
              </p>
            </div>
            {row.pct != null && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${Math.min(100, row.pct)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const myTrendBars = [
  { key: "pipeline", label: "Pipeline", color: "#94a3b8" },
  { key: "secured", label: "Secured", color: "#3b82f6" },
];

function PartnershipDashboard({ projects, currentUser }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Whole Company Sales Report — visible to every Partnership user, not just Admin.
  const yearlyCompany = useMemo(() => salesReportMetrics(projects, { year }), [projects, year]);
  const monthlyCompany = useMemo(() => salesReportMetrics(projects, { year, month }), [projects, year, month]);

  // My Partnership Performance — scoped strictly to projects this logged-in user
  // created. No other team member's numbers ever appear in this section.
  const mine = useMemo(() => projects.filter((p) => p.createdBy === currentUser.id), [projects, currentUser.id]);
  const yearlyMine = useMemo(() => salesReportMetrics(mine, { year }), [mine, year]);
  const monthlyMine = useMemo(() => salesReportMetrics(mine, { year, month }), [mine, year, month]);
  const myTargets = USER_TARGETS[currentUser.name];

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <SectionHeader title="Whole Company Sales Report" subtitle="Agency-wide pipeline, secured, and realized performance — visible to Admin/Management and all Partnership users" />
        <PeriodStatGrid label="This Year" metrics={yearlyCompany} />
        <PeriodStatGrid label="This Month" metrics={monthlyCompany} />
        <AchievementBlock label="Whole Company" monthly={monthlyCompany} yearly={yearlyCompany} targets={COMPANY_TARGETS} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title="Whole Company Pipeline vs Secured vs Realized" subtitle="Monthly, whole company">
            <TrendLineChart data={monthlyTrend(projects)} />
          </ChartCard>
          <ChartCard title="Whole Company Sales Trend" subtitle="Monthly secured sales for the year">
            <SecuredTrendChart data={monthlyTrend(projects)} />
          </ChartCard>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title="Project Status Distribution" subtitle="Whole company">
            <DonutChart data={statusDistribution(projects)} />
          </ChartCard>
          <ChartCard title="Pipeline Stage Funnel" subtitle="Whole company">
            <FunnelChart stages={funnelData(projects)} />
          </ChartCard>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-200/80 pt-6">
        <SectionHeader title="My Partnership Performance" subtitle={`Only ${currentUser.name}'s own projects — no other team member's numbers are shown here`} />
        <PeriodStatGrid label="This Year" metrics={yearlyMine} />
        <PeriodStatGrid label="This Month" metrics={monthlyMine} />
        <AchievementBlock label="My" monthly={monthlyMine} yearly={yearlyMine} targets={myTargets} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard title="My Monthly Pipeline vs Secured Sales">
            <GroupedBarChart data={monthlyTrend(mine)} bars={myTrendBars} valueFormatter={fmtIDR} />
          </ChartCard>
          <ChartCard title="My Project Status Distribution">
            <DonutChart data={statusDistribution(mine)} />
          </ChartCard>
        </div>
      </section>
    </div>
  );
}

function LegalDashboard({ projects, currentUser }) {
  const mine = useMemo(() => projects.filter((p) => p.legal && p.legalPIC === currentUser.name), [projects, currentUser.name]);
  const overdueSPK = mine.filter((p) => isPast(p.legal.spkDueDate) && !["Completed", "Signed"].includes(p.legal.legalStatus)).length;
  const waitingSignature = mine.filter((p) => p.legal.legalStatus === "Waiting Signature").length;
  const signed = mine.filter((p) => ["Signed", "Completed"].includes(p.legal.legalStatus)).length;
  const statusData = useMemo(() => {
    const c = {}; mine.forEach((p) => { c[p.legal.legalStatus] = (c[p.legal.legalStatus] || 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [mine]);
  const workload = useMemo(() => legalWorkload(projects.filter((p) => p.legal)), [projects]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard label="My Assigned Projects" value={mine.length} />
        <StatCard label="Overdue SPK" value={overdueSPK} accent={overdueSPK ? "text-rose-600" : ""} />
        <StatCard label="Waiting Signature" value={waitingSignature} accent="text-blue-600" />
        <StatCard label="Signed / Completed" value={signed} accent="text-emerald-600" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="SPK Status Distribution" subtitle="My assigned projects"><DonutChart data={statusData} /></ChartCard>
        <ChartCard title="Legal Workload by PIC" subtitle="Open SPKs per Legal PIC, whole team"><SimpleBarChart data={workload} color="#a855f7" /></ChartCard>
      </div>
    </div>
  );
}

function FinanceDashboard({ projects, currentUser }) {
  const mine = useMemo(() => projects.filter((p) => p.finance && p.financePIC === currentUser.name), [projects, currentUser.name]);
  const unpaid = mine.filter((p) => !p.finance.paidByClient).length;
  const paid = mine.filter((p) => p.finance.paidByClient).length;
  const overduePayment = mine.filter((p) => isPast(p.finance.paymentDueDate) && !p.finance.paidByClient).length;
  const talentPending = mine.filter((p) => p.finance.financeStatus === "Talent Payment Pending").length;
  const totalInvoiceValue = mine.reduce((s, p) => s + (p.totalPrice || 0), 0);
  const statusData = useMemo(() => {
    const c = {}; mine.forEach((p) => { c[p.finance.financeStatus] = (c[p.finance.financeStatus] || 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [mine]);
  const paidVsUnpaid = [{ name: "Paid", value: paid }, { name: "Unpaid", value: unpaid }].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard label="Total Invoice Value" value={fmtIDR(totalInvoiceValue)} />
        <StatCard label="Unpaid Invoices" value={unpaid} accent="text-amber-600" />
        <StatCard label="Overdue Payment" value={overduePayment} accent={overduePayment ? "text-rose-600" : ""} />
        <StatCard label="Talent Payment Pending" value={talentPending} accent="text-amber-600" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Payment Status Distribution" subtitle="My assigned projects"><DonutChart data={statusData} /></ChartCard>
        <ChartCard title="Paid vs. Unpaid Invoices"><DonutChart data={paidVsUnpaid} /></ChartCard>
      </div>
    </div>
  );
}

function PMDashboardView({ projects, currentUser }) {
  const mine = useMemo(() => projects.filter((p) => p.pm && p.pmPIC === currentUser.name), [projects, currentUser.name]);
  const deliv = useMemo(() => deliverableStats(mine), [mine]);
  const posting = useMemo(() => postingStats(mine), [mine]);
  const story = useMemo(() => storylineStats(mine), [mine]);
  const active = mine.filter((p) => !["Completed", "Posted", "Reported"].includes(p.pm.progress)).length;
  const workload = useMemo(() => pmWorkload(projects.filter((p) => p.pm)), [projects]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatCard label="My Active Projects" value={active} />
        <StatCard label="Upcoming Posting (7d)" value={posting.upcoming} accent="text-blue-600" />
        <StatCard label="Overdue Posting" value={posting.overdue} accent={posting.overdue ? "text-rose-600" : ""} />
        <StatCard label="Requires Storyline" value={story.required} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Deliverables by Status" subtitle={`${deliv.total} deliverables`}><DonutChart data={deliv.statusData} /></ChartCard>
        <ChartCard title="PM Workload Summary" subtitle="Active projects per PM, whole team"><SimpleBarChart data={workload} color="#14b8a6" /></ChartCard>
      </div>
    </div>
  );
}

/* =========================================================================
   PARTNERSHIP LOGBOOK
   ========================================================================= */
const LOGBOOK_QUICK_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active", test: (p) => !["Cancelled", "Lost", "Completed", "Realized"].includes(p.projectStatus) },
  { key: "verbalLock", label: "Verbal Lock", test: (p) => p.pipelineStage === "Verbal Lock" },
  { key: "confirmed", label: "Confirmed", test: (p) => p.projectStatus === "Confirmed" },
  { key: "lost", label: "Lost / Cancelled", test: (p) => ["Lost", "Cancelled"].includes(p.projectStatus) },
];

function PartnershipLogbookView({ projects, search, setSearch, onCreate, onOpen, canCreate, role, currentUser, canEditProject }) {
  // Personal View is the default for Partnership users — it's their own
  // leads. Admin/Management always effectively sees "Whole Team" (they can
  // edit everything regardless), but the toggle is still offered for a
  // consistent view of "my leads". Value summaries live in the Dashboard —
  // this page stays focused on data entry and tracking.
  const [logView, setLogView] = useState(role === "partnership" ? "personal" : "team");
  const [quickFilter, setQuickFilter] = useState("all");

  const scoped = logView === "personal" ? projects.filter((p) => p.createdBy === currentUser.id) : projects;
  const quickFilterDef = LOGBOOK_QUICK_FILTERS.find((f) => f.key === quickFilter);
  const stageFiltered = quickFilterDef?.test ? scoped.filter(quickFilterDef.test) : scoped;
  const filtered = stageFiltered.filter((p) =>
    [p.name, p.brandName, p.companyName, p.partnershipPIC].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Partnership Logbook</h1>
          <p className="text-sm text-slate-500">Main source of truth — every project lead starts here.</p>
        </div>
        {canCreate && <button className={btnPrimary} onClick={onCreate}><Plus size={15} /> New Project Lead</button>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {role === "partnership" && (
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setLogView("personal")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${logView === "personal" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                Personal View
              </button>
              <button
                onClick={() => setLogView("team")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${logView === "team" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                Whole Team View
              </button>
            </div>
          )}
          <span className="text-xs text-slate-400">
            {role === "partnership" ? (logView === "personal" ? "Personal View" : "Whole Team View") : "Whole Team View"} · {filtered.length} record{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
        {role === "partnership" && logView === "team" && (
          <p className="text-xs text-slate-400">Read-only for leads you didn't create — only Admin/Management can edit others' leads.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {LOGBOOK_QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${quickFilter === f.key ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/95 px-3.5 py-2.5 shadow-sm shadow-slate-200/60">
        <Search size={15} className="text-slate-400" />
        <input className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search project, brand, company, or PIC..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm shadow-slate-200/60">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <Th>Project ID</Th><Th>Project Name</Th><Th>Brand / Client</Th><Th>Client Status</Th>
              <Th>Project Status</Th><Th>Pipeline Stage</Th><Th>Pipeline Value</Th><Th>Locked Value</Th>
              <Th>Partnership PIC</Th><Th>Last Updated</Th><Th>Access</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><Td colSpan={11} className="text-slate-400">No project leads here yet.</Td></tr>}
            {filtered.map((p) => {
              const editable = canEditProject(p);
              return (
                <tr key={p.id} className="cursor-pointer border-t border-slate-100/80 transition hover:bg-indigo-50/40" onClick={() => onOpen(p.id)}>
                  <Td className="font-mono text-xs text-slate-400">{p.id}</Td>
                  <Td className="font-medium">{p.name}</Td>
                  <Td>{p.brandName}</Td>
                  <Td><Badge>{p.clientStatus}</Badge></Td>
                  <Td><Badge>{p.projectStatus}</Badge></Td>
                  <Td><Badge>{p.pipelineStage}</Badge></Td>
                  <Td>{fmtIDR(p.pipelineValue)}</Td>
                  <Td>{fmtIDR(p.lockedValue)}</Td>
                  <Td>{p.partnershipPIC}</Td>
                  <Td className="text-slate-400">{fmtDate(p.dateUpdated)}</Td>
                  <Td>
                    {editable
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><Pencil size={11} /> Editable</span>
                      : <span className="text-xs text-slate-400">View only</span>}
                  </Td>
                  <Td><ChevronRight size={14} className="text-slate-300" /></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectFormModal({ open, onClose, talents, onSave }) {
  const blank = {
    name: "", prospectiveClient: "", brandName: "", companyName: "", agencyName: "",
    picName: "", picPosition: "", picWhatsapp: "", picEmail: "",
    leadSource: "Referral", clientStatus: "New Prospect", projectSource: "Direct Brand",
    talentIds: [], sow: "", expectedTimeline: "", projectStatus: "New Inquiry", pipelineStage: "New Lead",
    topAgreement: "", notes: "", groupName: "", pipelineValue: "", totalPrice: "", toTalent: "", managementFee: "",
    defaultTax: "", customTax: "", taxMethod: "Gross Up", legalPIC: "", financePIC: "", pmPIC: "",
  };
  const [form, setForm] = useState(blank);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  function toggleTalent(id) {
    setForm((f) => {
      const has = f.talentIds.includes(id);
      const talentIds = has ? f.talentIds.filter((t) => t !== id) : [...f.talentIds, id];
      let defaultTax = f.defaultTax;
      if (!has) {
        const t = talents.find((tt) => tt.id === id);
        if (t) defaultTax = t.defaultTaxRate;
      }
      return { ...f, talentIds, defaultTax };
    });
  }

  function submit() {
    if (!form.name || !form.brandName) return;
    onSave(form);
    setForm(blank);
  }

  return (
    <Modal open={open} onClose={onClose} title="New Project Lead — Partnership Logbook" wide>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Project Name *"><input className={inputCls} value={form.name} onChange={(e) => set("name")(e.target.value)} /></Field>
        <Field label="Prospective Client"><input className={inputCls} value={form.prospectiveClient} onChange={(e) => set("prospectiveClient")(e.target.value)} /></Field>
        <Field label="Brand Name *"><input className={inputCls} value={form.brandName} onChange={(e) => set("brandName")(e.target.value)} /></Field>
        <Field label="Company Name"><input className={inputCls} value={form.companyName} onChange={(e) => set("companyName")(e.target.value)} /></Field>
        <Field label="Agency Name"><input className={inputCls} value={form.agencyName} onChange={(e) => set("agencyName")(e.target.value)} /></Field>
        <Field label="Group Name"><input className={inputCls} value={form.groupName} onChange={(e) => set("groupName")(e.target.value)} /></Field>

        <Field label="PIC Name"><input className={inputCls} value={form.picName} onChange={(e) => set("picName")(e.target.value)} /></Field>
        <Field label="PIC Position"><input className={inputCls} value={form.picPosition} onChange={(e) => set("picPosition")(e.target.value)} /></Field>
        <Field label="PIC WhatsApp"><input className={inputCls} value={form.picWhatsapp} onChange={(e) => set("picWhatsapp")(e.target.value)} /></Field>
        <Field label="PIC Email"><input className={inputCls} value={form.picEmail} onChange={(e) => set("picEmail")(e.target.value)} /></Field>

        <Field label="Client Status"><Select value={form.clientStatus} onChange={set("clientStatus")} options={CLIENT_STATUS} /></Field>
        <Field label="Lead Source"><input className={inputCls} value={form.leadSource} onChange={(e) => set("leadSource")(e.target.value)} /></Field>
        <Field label="Project Status"><Select value={form.projectStatus} onChange={set("projectStatus")} options={PROJECT_STATUS} /></Field>
        <Field label="Pipeline Stage"><Select value={form.pipelineStage} onChange={set("pipelineStage")} options={PIPELINE_STAGE} /></Field>

        <Field label="SOW" span><input className={inputCls} value={form.sow} onChange={(e) => set("sow")(e.target.value)} /></Field>
        <Field label="Expected Timeline"><input className={inputCls} value={form.expectedTimeline} onChange={(e) => set("expectedTimeline")(e.target.value)} /></Field>
        <Field label="TOP Agreement"><input className={inputCls} value={form.topAgreement} onChange={(e) => set("topAgreement")(e.target.value)} /></Field>

        <Field label="Talent(s)" span>
          <div className="flex flex-wrap gap-2">
            {talents.map((t) => (
              <button type="button" key={t.id} onClick={() => toggleTalent(t.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${form.talentIds.includes(t.id) ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-200"}`}>
                {t.name}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Pipeline Value (Rp)"><input type="number" className={inputCls} value={form.pipelineValue} onChange={(e) => set("pipelineValue")(e.target.value)} /></Field>
        <Field label="Total Price / Invoice (Rp)"><input type="number" className={inputCls} value={form.totalPrice} onChange={(e) => set("totalPrice")(e.target.value)} /></Field>
        <Field label="Net Talent Fee (Rp)"><input type="number" className={inputCls} value={form.toTalent} onChange={(e) => set("toTalent")(e.target.value)} /></Field>
        <Field label="Management Fee (Rp)"><input type="number" className={inputCls} value={form.managementFee} onChange={(e) => set("managementFee")(e.target.value)} /></Field>

        <Field label="Tax Method"><Select value={form.taxMethod} onChange={set("taxMethod")} options={TAX_METHOD} /></Field>
        <Field label="Default Tax Rate (from talent)"><input className={inputCls} value={form.defaultTax} onChange={(e) => set("defaultTax")(e.target.value)} placeholder="e.g. 0.025" /></Field>
        <Field label="Custom Tax Override"><input className={inputCls} value={form.customTax} onChange={(e) => set("customTax")(e.target.value)} placeholder="optional" /></Field>

        <Field label="Legal PIC"><input className={inputCls} value={form.legalPIC} onChange={(e) => set("legalPIC")(e.target.value)} placeholder="e.g. Yusuf Legal" /></Field>
        <Field label="Finance PIC"><input className={inputCls} value={form.financePIC} onChange={(e) => set("financePIC")(e.target.value)} placeholder="e.g. Sari Finance" /></Field>
        <Field label="PM PIC"><input className={inputCls} value={form.pmPIC} onChange={(e) => set("pmPIC")(e.target.value)} placeholder="e.g. Fajar PM" /></Field>

        <Field label="Notes" span><textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => set("notes")(e.target.value)} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={submit}>Create Project Lead</button>
      </div>
    </Modal>
  );
}

/* Admin-only: edit the two default confirmation templates. Per-project
   messages are generated from these, then edited independently per project. */
function TemplateSettingsModal({ open, onClose, templates, onSave }) {
  const [brand, setBrand] = useState(templates.brand);
  const [talent, setTalent] = useState(templates.talent);
  React.useEffect(() => { setBrand(templates.brand); setTalent(templates.talent); }, [templates, open]);

  return (
    <Modal open={open} onClose={onClose} title="Default Confirmation Templates (Admin)" wide>
      <p className="mb-3 text-xs text-slate-400">
        Use <code className="rounded bg-slate-100 px-1 py-0.5">{"{{variable_name}}"}</code> placeholders — they're filled in automatically from each project's data when Partnership generates a confirmation message.
      </p>
      <div className="space-y-4">
        <div>
          <SectionTitle right={<button className={btnPrimary} onClick={() => onSave("brand", brand)}>Save Brand Template</button>}>
            Brand Confirmation Template
          </SectionTitle>
          <textarea className={inputCls + " font-mono text-xs"} rows={10} value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
        <div>
          <SectionTitle right={<button className={btnPrimary} onClick={() => onSave("talent", talent)}>Save Talent Template</button>}>
            Talent Confirmation Template
          </SectionTitle>
          <textarea className={inputCls + " font-mono text-xs"} rows={10} value={talent} onChange={(e) => setTalent(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
        <button className={btnSecondary} onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

/* =========================================================================
   CLIENT DATABASE
   ========================================================================= */
function ClientDatabaseView({ clients, onOpenProject }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const filtered = clients.filter((c) => statusFilter === "All" || c.clientStatus === statusFilter);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Client Database</h1>
        <p className="text-sm text-slate-500">Generated automatically from the Partnership Logbook — no separate client creation needed.</p>
      </div>
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-slate-400" />
        <Select value={statusFilter} onChange={setStatusFilter} options={["All", ...CLIENT_STATUS]} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm shadow-slate-200/60">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <Th>Client / Brand</Th><Th>Company</Th><Th>PIC</Th><Th>Status</Th><Th>Related Projects</Th>
              <Th>Pipeline</Th><Th>Locked</Th><Th>Realized</Th><Th>Partnership PIC</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.key} className="border-t border-slate-100/80 align-top hover:bg-slate-50">
                <Td className="font-medium">{c.brandName}</Td>
                <Td>{c.companyName}{c.agencyName && c.agencyName !== "-" ? ` (via ${c.agencyName})` : ""}</Td>
                <Td>{c.picName}<div className="text-xs text-slate-400">{c.picWhatsapp}</div></Td>
                <Td><Badge>{c.clientStatus}</Badge></Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    {c.projects.map((p) => (
                      <button key={p.id} onClick={() => onOpenProject(p.id)} className="text-left text-xs font-medium text-indigo-600 hover:underline">
                        {p.name} <span className="text-slate-400">({p.status})</span>
                      </button>
                    ))}
                  </div>
                </Td>
                <Td>{fmtIDR(c.pipelineValue)}</Td>
                <Td>{fmtIDR(c.lockedValue)}</Td>
                <Td>{fmtIDR(c.realizedValue)}</Td>
                <Td>{c.partnershipPIC}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   TALENT DATABASE
   ========================================================================= */
function TalentDatabaseView({ talents, onCreate, onEdit, onOpen }) {
  const [search, setSearch] = useState("");
  const filtered = talents.filter((t) => [t.name, t.talentCode].join(" ").toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Talent Database</h1>
          <p className="text-sm text-slate-500">Reusable talent profiles with built-in tax settings.</p>
        </div>
        <button className={btnPrimary} onClick={onCreate}><Plus size={15} /> New Talent</button>
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/95 px-3.5 py-2.5 shadow-sm shadow-slate-200/60">
        <Search size={15} className="text-slate-400" />
        <input className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search talent name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm shadow-slate-200/60">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr>
              <Th>Code</Th><Th>Talent</Th><Th>Category</Th><Th>Type</Th><Th>Followers</Th><Th>Tax Entity</Th>
              <Th>Default Tax Rate</Th><Th>Status</Th><Th>Exclusivity</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="cursor-pointer border-t border-slate-100/80 transition hover:bg-indigo-50/40" onClick={() => onOpen(t.id)}>
                <Td className="font-mono text-xs text-slate-400">{t.talentCode}</Td>
                <Td className="font-medium">{t.name}<div className="text-xs text-slate-400">{t.ig}</div></Td>
                <Td>{t.category}</Td>
                <Td>{t.type}</Td>
                <Td>{t.followers}</Td>
                <Td>{t.taxEntityType}</Td>
                <Td>{(t.defaultTaxRate * 100).toFixed(1)}%</Td>
                <Td><Badge>{t.status}</Badge></Td>
                <Td><Badge>{t.exclusivity}</Badge></Td>
                <Td><button className="text-slate-400 hover:text-indigo-600" onClick={(e) => { e.stopPropagation(); onEdit(t); }}><Pencil size={14} /></button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Talent Detail Page — organized into the 7 sections requested:
   Basic / Social Media / Contact / Tax & Legal / Bank / Address / Internal Notes */
function TalentDetailView({ talent, onBack, onEdit }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Back to Talent Database
      </button>

      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-slate-400">{talent.talentCode}</p>
          <h1 className="text-lg font-semibold text-slate-800">{talent.name}</h1>
          <p className="text-sm text-slate-500">{talent.category} · {talent.type}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{talent.status}</Badge>
          <button className={btnSecondary} onClick={onEdit}><Pencil size={14} /> Edit</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
          <SectionTitle>1. Basic Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <InfoRow label="Talent Code" value={talent.talentCode} />
            <InfoRow label="Talent Name" value={talent.name} />
            <InfoRow label="Category / Niche" value={talent.category} />
            <InfoRow label="Talent Type" value={talent.type} />
            <InfoRow label="Talent Status" value={talent.status} />
            <InfoRow label="Exclusivity Status" value={talent.exclusivity} />
            <InfoRow label="Contract Status" value={talent.contractStatus} />
            <InfoRow label="Rate Card" value={fmtIDR(talent.rateCard)} />
            <InfoRow label="Talent Fee" value={fmtIDR(talent.talentFee)} />
            <InfoRow label="Management Fee" value={`${talent.managementFee}%`} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
          <SectionTitle>2. Social Media Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <InfoRow label="Instagram" value={talent.ig} />
            <InfoRow label="TikTok" value={talent.tiktok} />
            <InfoRow label="YouTube" value={talent.youtube} />
            <InfoRow label="Followers" value={talent.followers} />
            <InfoRow label="Engagement Rate" value={talent.engagementRate} />
            <InfoRow label="Audience Demographic" value={talent.audienceDemo} />
            <InfoRow label="Audience Location" value={talent.audienceLocation} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
          <SectionTitle>3. Contact Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <InfoRow label="Contact Person" value={talent.contact} />
            <InfoRow label="WhatsApp" value={talent.whatsapp} />
            <InfoRow label="Email" value={talent.email} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
          <SectionTitle>4. Tax & Legal Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <InfoRow label="NPWP Number" value={talent.npwpNumber} />
            <InfoRow label="NPWP Name" value={talent.npwpName} />
            <InfoRow label="NPWP Status" value={talent.npwpStatus} />
            <InfoRow label="Tax Entity Type" value={talent.taxEntityType} />
            <InfoRow label="Default Tax Rate" value={`${(talent.defaultTaxRate * 100).toFixed(2)}%`} />
            <InfoRow label="Tax Notes" value={talent.taxNotes} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
          <SectionTitle>5. Bank Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <InfoRow label="Bank Name" value={talent.bankName} />
            <InfoRow label="Bank Account Name" value={talent.bankAccountName} />
            <InfoRow label="Bank Account Number" value={talent.bankAccountNumber} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
          <SectionTitle>6. Address Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <InfoRow label="Address" value={talent.address} />
            <InfoRow label="City" value={talent.city} />
            <InfoRow label="Province" value={talent.province} />
            <InfoRow label="Postal Code" value={talent.postalCode} />
            <InfoRow label="Country" value={talent.country} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60 xl:col-span-2">
          <SectionTitle>7. Internal Notes</SectionTitle>
          <p className="text-sm text-slate-600">{talent.notes || "—"}</p>
          <p className="mt-2 text-xs text-slate-400">Created by {talent.createdBy} on {fmtDate(talent.createdAt)} · Last updated by {talent.updatedBy} on {fmtDate(talent.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}

function TalentFormModal({ open, onClose, onSave, existing }) {
  const blank = {
    talentCode: "", name: "", category: "", type: "Creator", ig: "", tiktok: "", youtube: "", followers: "", engagementRate: "",
    audienceDemo: "", audienceLocation: "", rateCard: "", talentFee: "", managementFee: "", contact: "", whatsapp: "", email: "",
    npwpNumber: "", npwpName: "", npwpStatus: "Has NPWP", taxEntityType: "Individual", defaultTaxRate: 0.025, taxNotes: "",
    bankName: "", bankAccountName: "", bankAccountNumber: "",
    address: "", city: "", province: "", postalCode: "", country: "Indonesia",
    contractStatus: "Active", exclusivity: "Non-exclusive", status: "Active", notes: "",
  };
  const [form, setForm] = useState(existing || blank);
  React.useEffect(() => setForm(existing || blank), [existing, open]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  function suggestCode() {
    if (form.talentCode || !form.name) return;
    const code = form.name.replace(/[^a-zA-Z ]/g, "").split(" ")[0].slice(0, 3).toUpperCase();
    set("talentCode")(code);
  }

  return (
    <Modal open={open} onClose={onClose} title={existing ? `Edit Talent — ${existing.name}` : "New Talent"} wide>
      <div className="space-y-5">
        <div>
          <SectionTitle>1. Basic Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Talent Name *"><input className={inputCls} value={form.name} onChange={(e) => set("name")(e.target.value)} onBlur={suggestCode} /></Field>
            <Field label="Talent Code *"><input className={inputCls + " font-mono uppercase"} value={form.talentCode} onChange={(e) => set("talentCode")(e.target.value.toUpperCase())} placeholder="e.g. NDA — used in Project IDs" /></Field>
            <Field label="Category / Niche"><input className={inputCls} value={form.category} onChange={(e) => set("category")(e.target.value)} /></Field>
            <Field label="Talent Type"><Select value={form.type} onChange={set("type")} options={TALENT_TYPE} /></Field>
            <Field label="Talent Status"><Select value={form.status} onChange={set("status")} options={TALENT_STATUS} /></Field>
            <Field label="Exclusivity Status"><Select value={form.exclusivity} onChange={set("exclusivity")} options={EXCLUSIVITY} /></Field>
            <Field label="Contract Status"><input className={inputCls} value={form.contractStatus} onChange={(e) => set("contractStatus")(e.target.value)} /></Field>
            <Field label="Rate Card (Rp)"><input type="number" className={inputCls} value={form.rateCard} onChange={(e) => set("rateCard")(e.target.value)} /></Field>
            <Field label="Talent Fee (Rp)"><input type="number" className={inputCls} value={form.talentFee} onChange={(e) => set("talentFee")(e.target.value)} /></Field>
            <Field label="Management Fee (%)"><input type="number" className={inputCls} value={form.managementFee} onChange={(e) => set("managementFee")(e.target.value)} /></Field>
          </div>
        </div>

        <div>
          <SectionTitle>2. Social Media Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Instagram"><input className={inputCls} value={form.ig} onChange={(e) => set("ig")(e.target.value)} /></Field>
            <Field label="TikTok"><input className={inputCls} value={form.tiktok} onChange={(e) => set("tiktok")(e.target.value)} /></Field>
            <Field label="YouTube"><input className={inputCls} value={form.youtube} onChange={(e) => set("youtube")(e.target.value)} /></Field>
            <Field label="Followers Summary"><input className={inputCls} value={form.followers} onChange={(e) => set("followers")(e.target.value)} /></Field>
            <Field label="Engagement Rate"><input className={inputCls} value={form.engagementRate} onChange={(e) => set("engagementRate")(e.target.value)} /></Field>
            <Field label="Audience Demographic"><input className={inputCls} value={form.audienceDemo} onChange={(e) => set("audienceDemo")(e.target.value)} /></Field>
            <Field label="Audience Location" span><input className={inputCls} value={form.audienceLocation} onChange={(e) => set("audienceLocation")(e.target.value)} /></Field>
          </div>
        </div>

        <div>
          <SectionTitle>3. Contact Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Contact Person"><input className={inputCls} value={form.contact} onChange={(e) => set("contact")(e.target.value)} /></Field>
            <Field label="WhatsApp"><input className={inputCls} value={form.whatsapp} onChange={(e) => set("whatsapp")(e.target.value)} /></Field>
            <Field label="Email" span><input className={inputCls} value={form.email} onChange={(e) => set("email")(e.target.value)} /></Field>
          </div>
        </div>

        <div>
          <SectionTitle>4. Tax & Legal Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="NPWP Number"><input className={inputCls} value={form.npwpNumber} onChange={(e) => set("npwpNumber")(e.target.value)} placeholder="00.000.000.0-000.000" /></Field>
            <Field label="NPWP Name"><input className={inputCls} value={form.npwpName} onChange={(e) => set("npwpName")(e.target.value)} /></Field>
            <Field label="NPWP Status"><Select value={form.npwpStatus} onChange={set("npwpStatus")} options={NPWP_STATUS} /></Field>
            <Field label="Tax Entity Type"><Select value={form.taxEntityType} onChange={set("taxEntityType")} options={TAX_ENTITY} /></Field>
            <Field label="Default Tax Rate (decimal)"><input type="number" step="0.001" className={inputCls} value={form.defaultTaxRate} onChange={(e) => set("defaultTaxRate")(Number(e.target.value))} /></Field>
            <Field label="Tax Notes"><input className={inputCls} value={form.taxNotes} onChange={(e) => set("taxNotes")(e.target.value)} /></Field>
          </div>
        </div>

        <div>
          <SectionTitle>5. Bank Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Bank Name"><input className={inputCls} value={form.bankName} onChange={(e) => set("bankName")(e.target.value)} /></Field>
            <Field label="Bank Account Name"><input className={inputCls} value={form.bankAccountName} onChange={(e) => set("bankAccountName")(e.target.value)} /></Field>
            <Field label="Bank Account Number" span><input className={inputCls} value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber")(e.target.value)} /></Field>
          </div>
        </div>

        <div>
          <SectionTitle>6. Address Information</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Address" span><input className={inputCls} value={form.address} onChange={(e) => set("address")(e.target.value)} /></Field>
            <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => set("city")(e.target.value)} /></Field>
            <Field label="Province"><input className={inputCls} value={form.province} onChange={(e) => set("province")(e.target.value)} /></Field>
            <Field label="Postal Code"><input className={inputCls} value={form.postalCode} onChange={(e) => set("postalCode")(e.target.value)} /></Field>
            <Field label="Country"><input className={inputCls} value={form.country} onChange={(e) => set("country")(e.target.value)} /></Field>
          </div>
        </div>

        <div>
          <SectionTitle>7. Internal Notes</SectionTitle>
          <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => set("notes")(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={() => { if (form.name && form.talentCode) onSave(form, existing?.id); }}>{existing ? "Save Changes" : "Create Talent"}</button>
      </div>
    </Modal>
  );
}

/* =========================================================================
   LEGAL / FINANCE / PM TRACKERS
   ========================================================================= */
function LegalTrackerView({ projects, onOpen, onUpdate }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Legal Tracker</h1>
        <p className="text-sm text-slate-500">Confirmed projects requiring SPK / agreement handling.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm shadow-slate-200/60">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr><Th>Project</Th><Th>Brand</Th><Th>Legal PIC</Th><Th>SPK Due Date</Th><Th>Legal Status</Th><Th>Last Edit</Th><Th></Th></tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const overdue = isPast(p.legal.spkDueDate) && !["Completed", "Signed"].includes(p.legal.legalStatus);
              return (
                <tr key={p.id} className="border-t border-slate-100/80 transition hover:bg-indigo-50/40">
                  <Td className="cursor-pointer font-medium text-indigo-600" onClick={() => onOpen(p.id)}>{p.name}</Td>
                  <Td>{p.brandName}</Td>
                  <Td>{p.legalPIC || "—"}</Td>
                  <Td>{fmtDate(p.legal.spkDueDate)} {overdue && <OverdueTag />}</Td>
                  <Td>
                    <Select value={p.legal.legalStatus} onChange={(v) => onUpdate(p.id, { legalStatus: v })} options={LEGAL_STATUS} />
                  </Td>
                  <Td className="text-slate-400">{fmtDate(p.legal.lastEditLegal)}</Td>
                  <Td><button className="text-slate-400 hover:text-indigo-600" onClick={() => onOpen(p.id)}><ChevronRight size={14} /></button></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinanceTrackerView({ projects, onOpen, onUpdate }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Finance Operations Tracker</h1>
        <p className="text-sm text-slate-500">Invoice, tax, payment, and talent payout tracking.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm shadow-slate-200/60">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr><Th>Project</Th><Th>Brand</Th><Th>Invoice #</Th><Th>Payment Due</Th><Th>Paid by Client</Th><Th>Finance Status</Th><Th></Th></tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const overdue = isPast(p.finance.paymentDueDate) && !p.finance.paidByClient;
              return (
                <tr key={p.id} className="border-t border-slate-100/80 transition hover:bg-indigo-50/40">
                  <Td className="cursor-pointer font-medium text-indigo-600" onClick={() => onOpen(p.id)}>{p.name}</Td>
                  <Td>{p.brandName}</Td>
                  <Td>
                    <input className={inputCls + " w-32"} value={p.finance.invoiceNumber} onChange={(e) => onUpdate(p.id, { invoiceNumber: e.target.value })} />
                  </Td>
                  <Td>{fmtDate(p.finance.paymentDueDate)} {overdue && <OverdueTag />}</Td>
                  <Td>
                    <input type="checkbox" checked={p.finance.paidByClient} onChange={(e) => onUpdate(p.id, { paidByClient: e.target.checked, paymentSuccess: e.target.checked })} />
                  </Td>
                  <Td><Select value={p.finance.financeStatus} onChange={(v) => onUpdate(p.id, { financeStatus: v })} options={FINANCE_STATUS} /></Td>
                  <Td><button className="text-slate-400 hover:text-indigo-600" onClick={() => onOpen(p.id)}><ChevronRight size={14} /></button></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PMTrackerView({ projects, onOpen, onUpdate }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Project Manager Tracker</h1>
        <p className="text-sm text-slate-500">Execution, brief, storyline, and posting deadlines.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm shadow-slate-200/60">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr><Th>Project</Th><Th>Brand</Th><Th>Posting Due</Th><Th>Storyline</Th><Th>Progress</Th><Th>Need Action</Th><Th></Th></tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const overduePost = isPast(p.pm.estimatedPostingDueDate) && !["Posted","Completed"].includes(p.pm.progress);
              const overdueStory = p.pm.storylineRequired === "Yes" && isPast(p.pm.storylineDueDate) && p.pm.storylineStatus !== "Approved";
              return (
                <tr key={p.id} className="border-t border-slate-100/80 transition hover:bg-indigo-50/40">
                  <Td className="cursor-pointer font-medium text-indigo-600" onClick={() => onOpen(p.id)}>{p.name}</Td>
                  <Td>{p.brandName}</Td>
                  <Td>{fmtDate(p.pm.estimatedPostingDueDate)} {overduePost && <OverdueTag />}</Td>
                  <Td><Badge>{p.pm.storylineStatus}</Badge> {overdueStory && <OverdueTag />}</Td>
                  <Td><Select value={p.pm.progress} onChange={(v) => onUpdate(p.id, { progress: v })} options={PROGRESS} /></Td>
                  <Td>
                    <input type="checkbox" checked={p.pm.needAction} onChange={(e) => onUpdate(p.id, { needAction: e.target.checked })} />
                  </Td>
                  <Td><button className="text-slate-400 hover:text-indigo-600" onClick={() => onOpen(p.id)}><ChevronRight size={14} /></button></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   DELIVERABLES
   ========================================================================= */
function DeliverablesView({ projects, talents, onUpdate, onOpen }) {
  const rows = [];
  projects.forEach((p) => p.deliverables.forEach((d) => rows.push({ ...d, projectName: p.name, brand: p.brandName, projectRealId: p.id })));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Deliverables Tracker</h1>
        <p className="text-sm text-slate-500">Every content deliverable across all confirmed projects.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm shadow-slate-200/60">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr><Th>Project</Th><Th>Talent</Th><Th>Type</Th><Th>Description</Th><Th>Due Date</Th><Th>Status</Th><Th>Posted Link</Th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><Td colSpan={7} className="text-slate-400">No deliverables yet.</Td></tr>}
            {rows.map((d) => {
              const t = talents.find((tt) => tt.id === d.talentId);
              const overdue = isPast(d.dueDate) && !["Posted","Completed","Cancelled"].includes(d.status);
              return (
                <tr key={d.id} className="border-t border-slate-100/80 transition hover:bg-indigo-50/40">
                  <Td className="cursor-pointer font-medium text-indigo-600" onClick={() => onOpen(d.projectRealId)}>{d.projectName}</Td>
                  <Td>{t?.name || "—"}</Td>
                  <Td>{d.type}</Td>
                  <Td>{d.description}</Td>
                  <Td>{fmtDate(d.dueDate)} {overdue && <OverdueTag />}</Td>
                  <Td><Select value={d.status} onChange={(v) => onUpdate(d.projectRealId, d.id, { status: v })} options={DELIVERABLE_STATUS} /></Td>
                  <Td>{d.postedLink ? <a className="text-indigo-600 underline" href={d.postedLink} target="_blank" rel="noreferrer">Link</a> : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   DOCUMENTS
   ========================================================================= */
function DocumentsView({ projects, onOpen }) {
  const rows = [];
  projects.forEach((p) => p.documents.forEach((d) => rows.push({ ...d, projectName: p.name, projectRealId: p.id })));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Documents</h1>
        <p className="text-sm text-slate-500">All SPKs, invoices, tax documents, and attachments, linked to their project.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm shadow-slate-200/60">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr><Th>Project</Th><Th>Type</Th><Th>Name</Th><Th>Uploaded By</Th><Th>Uploaded At</Th><Th>Link</Th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><Td colSpan={6} className="text-slate-400">No documents yet.</Td></tr>}
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-slate-100/80 transition hover:bg-indigo-50/40">
                <Td className="cursor-pointer font-medium text-indigo-600" onClick={() => onOpen(d.projectRealId)}>{d.projectName}</Td>
                <Td><Badge>{d.type}</Badge></Td>
                <Td>{d.name}</Td>
                <Td>{d.uploadedBy}</Td>
                <Td className="text-slate-400">{fmtDate(d.uploadedAt)}</Td>
                <Td>{d.link ? <a className="text-indigo-600 underline" href={d.link} target="_blank" rel="noreferrer">Open</a> : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   ACTIVITY LOGS
   ========================================================================= */
function ActivityLogsView({ logs, projects }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Activity Logs</h1>
        <p className="text-sm text-slate-500">Every meaningful change across the system, in one audit trail.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm shadow-slate-200/60">
        <table className="w-full">
          <thead className="bg-slate-50/80">
            <tr><Th>Timestamp</Th><Th>User</Th><Th>Role</Th><Th>Module</Th><Th>Project</Th><Th>Action</Th><Th>Field</Th><Th>Old → New</Th></tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const proj = projects.find((p) => p.id === l.projectId);
              return (
                <tr key={l.id} className="border-t border-slate-100/80">
                  <Td className="text-slate-400">{new Date(l.timestamp).toLocaleString("en-GB")}</Td>
                  <Td className="font-medium">{l.user}</Td>
                  <Td className="text-slate-400">{l.role ? ROLES[l.role] : "—"}</Td>
                  <Td><Badge>{l.module}</Badge></Td>
                  <Td>{proj?.name || "—"}</Td>
                  <Td>{l.action}</Td>
                  <Td className="text-slate-400">{l.field || "—"}</Td>
                  <Td>{l.field ? <span className="text-xs">{l.oldValue} <ChevronRight size={10} className="inline" /> {l.newValue}</span> : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   PROJECT DETAIL — TABS
   ========================================================================= */
function ProjectDetailView({ project, talents, role, currentUser, users, logs, canEditProject, templates, onBack, onUpdateProject, onUpdateSub, onAddDeliverable, onUpdateDeliverable, onAddDocument, onSaveBrand, onSaveTalent, onLogGenerate, onOpenTemplateSettings }) {
  const [tab, setTab] = useState("overview");
  const canEditPartnership = canEditProject(project);
  const isOwner = project.createdBy === currentUser.id;
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "partnership", label: "Client & Project Confirmation" },
    { key: "legal", label: "Legal" },
    { key: "finance", label: "Finance" },
    { key: "pm", label: "PM / Deliverables" },
    { key: "documents", label: "Documents" },
    { key: "activity", label: "Activity Logs" },
  ];

  const projectTalents = talents.filter((t) => project.talentIds.includes(t.id));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={14} /> Back to Partnership Logbook
      </button>

      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-slate-400">{project.id}</p>
          <h1 className="text-lg font-semibold text-slate-800">{project.name}</h1>
          <p className="text-sm text-slate-500">{project.brandName} · {project.companyName}</p>
        </div>
        <div className="flex gap-2">
          <Badge>{project.projectStatus}</Badge>
          <Badge>{project.pipelineStage}</Badge>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab project={project} projectTalents={projectTalents} />}
      {tab === "partnership" && (
        <PartnershipTab
          project={project} talents={talents} users={users} templates={templates}
          onUpdateProject={onUpdateProject} onSaveBrand={onSaveBrand} onSaveTalent={onSaveTalent}
          onLogGenerate={onLogGenerate} onOpenTemplateSettings={onOpenTemplateSettings}
          canEdit={canEditPartnership} isOwner={isOwner} role={role}
        />
      )}
      {tab === "legal" && <LegalTab project={project} onUpdateSub={onUpdateSub} canEdit={role === "admin" || role === "legal"} />}
      {tab === "finance" && <FinanceTab project={project} onUpdateSub={onUpdateSub} canEdit={role === "admin" || role === "finance"} />}
      {tab === "pm" && <PMTab project={project} talents={talents} onUpdateSub={onUpdateSub} onAddDeliverable={onAddDeliverable} onUpdateDeliverable={onUpdateDeliverable} canEdit={role === "admin" || role === "pm"} />}
      {tab === "documents" && <DocumentsTab project={project} onAddDocument={onAddDocument} />}
      {tab === "activity" && <ActivityLogsView logs={logs} projects={[project]} />}
    </div>
  );
}

function OverviewTab({ project, projectTalents }) {
  const overduePost = project.pm && isPast(project.pm.estimatedPostingDueDate) && !["Posted","Completed"].includes(project.pm.progress);
  const overdueSPK = project.legal && isPast(project.legal.spkDueDate) && !["Completed","Signed"].includes(project.legal.legalStatus);
  const overduePay = project.finance && isPast(project.finance.paymentDueDate) && !project.finance.paidByClient;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60 md:col-span-2">
        <SectionTitle>Key Info</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
          <InfoRow label="SOW" value={project.sow} />
          <InfoRow label="Timeline" value={project.expectedTimeline} />
          <InfoRow label="Talent(s)" value={projectTalents.map((t) => t.name).join(", ") || "—"} />
          <InfoRow label="TOP Agreement" value={project.topAgreement} />
          <InfoRow label="Partnership PIC" value={project.partnershipPIC} />
          <InfoRow label="Legal PIC" value={project.legalPIC || "Unassigned"} />
          <InfoRow label="Finance PIC" value={project.financePIC || "Unassigned"} />
          <InfoRow label="PM PIC" value={project.pmPIC || "Unassigned"} />
        </div>
        {(overduePost || overdueSPK || overduePay) && (
          <div className="mt-2 space-y-1 rounded-lg bg-rose-50 p-3">
            {overdueSPK && <p className="text-xs text-rose-700">⚠ SPK is overdue.</p>}
            {overduePay && <p className="text-xs text-rose-700">⚠ Client payment is overdue.</p>}
            {overduePost && <p className="text-xs text-rose-700">⚠ Posting deadline is overdue.</p>}
          </div>
        )}
      </div>
      <div className="space-y-3">
        <StatCard label="Pipeline Value" value={fmtIDR(project.pipelineValue)} />
        <StatCard label="Locked Value" value={fmtIDR(project.lockedValue)} accent="text-blue-600" />
        <StatCard label="Realized Value" value={fmtIDR(project.realizedValue)} accent="text-emerald-600" />
      </div>
    </div>
  );
}
function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value || "—"}</p>
    </div>
  );
}

function PartnershipTab({ project, talents, users, templates, onUpdateProject, onSaveBrand, onSaveTalent, onLogGenerate, onOpenTemplateSettings, canEdit, isOwner, role }) {
  const [local, setLocal] = useState(project);
  React.useEffect(() => setLocal(project), [project]);
  const set = (k) => (v) => setLocal((l) => ({ ...l, [k]: v }));
  const save = () => onUpdateProject(local, "Client & Project Confirmation");

  const taxResult = calcTax(project.toTalent, project.taxUsed, project.taxMethod);
  const vars = useMemo(() => buildConfirmationVars(project, talents, users), [project, talents, users]);

  const [brandMsg, setBrandMsg] = useState(project.brandConfirmationMessage || "");
  const [talentMsg, setTalentMsg] = useState(project.talentConfirmationMessage || "");
  const [copied, setCopied] = useState("");

  function generateBrand() {
    setBrandMsg(renderTemplate(templates.brand, vars));
    onLogGenerate("Brand");
  }
  function generateTalent() {
    setTalentMsg(renderTemplate(templates.talent, vars));
    onLogGenerate("Talent");
  }
  function copyText(text, which) {
    navigator.clipboard?.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="space-y-4">
      {!canEdit && role === "partnership" && !isOwner && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
          This project was created by <span className="font-medium">{project.partnershipPIC}</span>. You're in Whole Team View — only they or Admin/Management can edit it.
        </div>
      )}

      {/* 1. Client Information */}
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
        <SectionTitle right={canEdit && <button className={btnPrimary} onClick={save}><Check size={14} /> Save Changes</button>}>
          1. Client Information
        </SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Prospective Client Name"><input className={inputCls} value={local.prospectiveClient} onChange={(e) => set("prospectiveClient")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Brand Name"><input className={inputCls} value={local.brandName} onChange={(e) => set("brandName")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Company Name"><input className={inputCls} value={local.companyName} onChange={(e) => set("companyName")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Agency Name"><input className={inputCls} value={local.agencyName} onChange={(e) => set("agencyName")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="PIC Name"><input className={inputCls} value={local.picName} onChange={(e) => set("picName")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="PIC Position"><input className={inputCls} value={local.picPosition} onChange={(e) => set("picPosition")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="PIC WhatsApp"><input className={inputCls} value={local.picWhatsapp} onChange={(e) => set("picWhatsapp")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="PIC Email"><input className={inputCls} value={local.picEmail} onChange={(e) => set("picEmail")(e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </div>

      {/* 2. Status & Pipeline */}
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
        <SectionTitle>2. Status & Pipeline</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Lead / Client Status"><Select value={local.clientStatus} onChange={set("clientStatus")} options={CLIENT_STATUS} disabled={!canEdit} /></Field>
          <Field label="Project Status"><Select value={local.projectStatus} onChange={set("projectStatus")} options={PROJECT_STATUS} disabled={!canEdit} /></Field>
          <Field label="Pipeline Stage"><Select value={local.pipelineStage} onChange={set("pipelineStage")} options={PIPELINE_STAGE} disabled={!canEdit} /></Field>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 border-t border-slate-100 pt-3">
          <Field label="Date First Contacted"><input type="date" className={inputCls} value={local.dateFirstContacted} onChange={(e) => set("dateFirstContacted")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Date Pitch Sent"><input type="date" className={inputCls} value={local.datePitchSent} onChange={(e) => set("datePitchSent")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Date Verbal Lock"><input type="date" className={inputCls} value={local.dateVerbalLock} onChange={(e) => set("dateVerbalLock")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Date Project Confirmed"><input type="date" className={inputCls} value={local.dateProjectConfirmed} onChange={(e) => set("dateProjectConfirmed")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Date Project Realized"><input type="date" className={inputCls} value={local.dateProjectRealized} onChange={(e) => set("dateProjectRealized")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Date Lost / Cancelled"><input type="date" className={inputCls} value={local.dateProjectCancelled} onChange={(e) => set("dateProjectCancelled")(e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </div>

      {/* 3. Project Value */}
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
        <SectionTitle>3. Project Value</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Pipeline Estimated Value (Rp)"><input type="number" className={inputCls} value={local.pipelineValue} onChange={(e) => set("pipelineValue")(Number(e.target.value))} disabled={!canEdit} /></Field>
          <Field label="Project Value Deal / Locked Value (Rp)"><input type="number" className={inputCls} value={local.lockedValue} onChange={(e) => set("lockedValue")(Number(e.target.value))} disabled={!canEdit} /></Field>
          <Field label="Realized Value (Rp)"><input type="number" className={inputCls} value={local.realizedValue} onChange={(e) => set("realizedValue")(Number(e.target.value))} disabled={!canEdit} /></Field>
          <Field label="Total Price / Invoice to Brand (Rp)"><input type="number" className={inputCls} value={local.totalPrice} onChange={(e) => set("totalPrice")(Number(e.target.value))} disabled={!canEdit} /></Field>
          <Field label="TOP Agreement"><input className={inputCls} value={local.topAgreement} onChange={(e) => set("topAgreement")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Notes on Value Adjustment"><input className={inputCls} value={local.valueAdjustmentNotes} onChange={(e) => set("valueAdjustmentNotes")(e.target.value)} disabled={!canEdit} placeholder="e.g. renegotiated after scope change" /></Field>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4 border-t border-slate-100 pt-3 text-sm">
          <InfoRow label="Net Talent Fee" value={fmtIDR(project.toTalent)} />
          <InfoRow label="Tax Rate Used" value={`${(project.taxUsed * 100).toFixed(2)}%`} />
          <InfoRow label="Gross Amount (DPP Gross Up)" value={fmtIDR(taxResult.gross)} />
          <InfoRow label="Final Net Payout to Talent" value={fmtIDR(taxResult.net)} />
        </div>
      </div>

      {/* 4. Locked Project Details */}
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
        <SectionTitle>4. Locked Project Details</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Talent(s)" span>
            <p className="text-sm text-slate-700">{talents.filter((t) => project.talentIds.includes(t.id)).map((t) => t.name).join(", ") || "—"}</p>
          </Field>
          <Field label="Locked SOW Details" span>
            <textarea className={inputCls} rows={3} value={local.lockedSOWDetails} onChange={(e) => set("lockedSOWDetails")(e.target.value)} disabled={!canEdit} placeholder={"e.g.\n2x TikTok Video No Voice\n2x BC 30 Days\n1x Yellow Cart"} />
          </Field>
          <Field label="Timeline"><input className={inputCls} value={local.expectedTimeline} onChange={(e) => set("expectedTimeline")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Post Timeline / Due Date"><input className={inputCls + " bg-slate-50"} value={project.pm?.estimatedPostingDueDate ? fmtDate(project.pm.estimatedPostingDueDate) : "Set by PM after confirmation"} disabled /></Field>
          <Field label="Group Name"><input className={inputCls} value={local.groupName} onChange={(e) => set("groupName")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Assigned Legal PIC"><input className={inputCls} value={local.legalPIC} onChange={(e) => set("legalPIC")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Assigned Finance PIC"><input className={inputCls} value={local.financePIC} onChange={(e) => set("financePIC")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Assigned PM PIC"><input className={inputCls} value={local.pmPIC} onChange={(e) => set("pmPIC")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Oversight PIC Name"><input className={inputCls} value={local.oversightPICName} onChange={(e) => set("oversightPICName")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Oversight PIC WhatsApp"><input className={inputCls} value={local.oversightPICWhatsapp} onChange={(e) => set("oversightPICWhatsapp")(e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </div>

      {/* 5. Confirmation Messages */}
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
        <SectionTitle right={role === "admin" && <button className={btnSecondary} onClick={onOpenTemplateSettings}>Manage Default Templates</button>}>
          5. Confirmation Messages
        </SectionTitle>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Brand Confirmation</p>
            <div className="flex gap-2">
              <button className={btnSecondary} onClick={generateBrand} disabled={!canEdit}>Generate</button>
              <button className={btnSecondary} onClick={() => copyText(brandMsg, "brand")}>
                {copied === "brand" ? <Check size={14} /> : <Copy size={14} />} {copied === "brand" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <textarea className={inputCls + " font-mono text-xs"} rows={12} value={brandMsg} onChange={(e) => setBrandMsg(e.target.value)} disabled={!canEdit} placeholder="Click Generate to pre-fill from project data." />
          {canEdit && <div className="flex justify-end"><button className={btnPrimary} onClick={() => onSaveBrand(brandMsg)}>Save Brand Confirmation Version</button></div>}
          {project.brandConfirmationMessage && <p className="text-xs text-slate-400">Latest saved brand confirmation is stored on this project record.</p>}
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Talent Confirmation</p>
            <div className="flex gap-2">
              <button className={btnSecondary} onClick={generateTalent} disabled={!canEdit}>Generate</button>
              <button className={btnSecondary} onClick={() => copyText(talentMsg, "talent")}>
                {copied === "talent" ? <Check size={14} /> : <Copy size={14} />} {copied === "talent" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <textarea className={inputCls + " font-mono text-xs"} rows={12} value={talentMsg} onChange={(e) => setTalentMsg(e.target.value)} disabled={!canEdit} placeholder="Click Generate to pre-fill from project data." />
          {canEdit && <div className="flex justify-end"><button className={btnPrimary} onClick={() => onSaveTalent(talentMsg)}>Save Talent Confirmation Version</button></div>}
          {project.talentConfirmationMessage && <p className="text-xs text-slate-400">Latest saved talent confirmation is stored on this project record.</p>}
        </div>
      </div>
    </div>
  );
}

function LegalTab({ project, onUpdateSub, canEdit }) {
  if (!project.legal) return <EmptyState text="Legal record will be created automatically once the project is Confirmed." />;
  const l = project.legal;
  const set = (k) => (v) => onUpdateSub("legal", { [k]: v }, "Legal");
  const overdue = isPast(l.spkDueDate) && !["Completed","Signed"].includes(l.legalStatus);
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
      <SectionTitle>Legal Tracker {overdue && <OverdueTag />}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Agreement Issuer"><input className={inputCls} value={l.agreementIssuer} onChange={(e) => set("agreementIssuer")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Nama Perusahaan"><input className={inputCls} value={l.namaPerusahaan} onChange={(e) => set("namaPerusahaan")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Alamat Perusahaan"><input className={inputCls} value={l.alamatPerusahaan} onChange={(e) => set("alamatPerusahaan")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Nama Penanggung Jawab"><input className={inputCls} value={l.namaPenanggungJawab} onChange={(e) => set("namaPenanggungJawab")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Jabatan"><input className={inputCls} value={l.jabatan} onChange={(e) => set("jabatan")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="SPK Due Date"><input type="date" className={inputCls} value={l.spkDueDate} onChange={(e) => set("spkDueDate")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="SPK File Name"><input className={inputCls} value={l.spkFileName} onChange={(e) => set("spkFileName")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="SPK Link" span><input className={inputCls} value={l.spkLink} onChange={(e) => set("spkLink")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Legal Status"><Select value={l.legalStatus} onChange={set("legalStatus")} options={LEGAL_STATUS} disabled={!canEdit} /></Field>
        <Field label="Legal Notes" span><textarea className={inputCls} rows={2} value={l.legalNotes} onChange={(e) => set("legalNotes")(e.target.value)} disabled={!canEdit} /></Field>
      </div>
      <p className="mt-2 text-xs text-slate-400">Last edited by Legal: {fmtDate(l.lastEditLegal)}</p>
    </div>
  );
}

function FinanceTab({ project, onUpdateSub, canEdit }) {
  if (!project.finance) return <EmptyState text="Finance record will be created automatically once the project is Confirmed." />;
  const f = project.finance;
  const set = (k) => (v) => onUpdateSub("finance", { [k]: v }, "Finance");
  const overdue = isPast(f.paymentDueDate) && !f.paidByClient;
  const taxResult = calcTax(project.toTalent, project.taxUsed, project.taxMethod);
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
      <SectionTitle>Finance Operations Tracker {overdue && <OverdueTag />}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Total Price / Invoice"><input className={inputCls + " bg-slate-50"} value={fmtIDR(project.totalPrice)} disabled /></Field>
        <Field label="Final Net Payout"><input className={inputCls + " bg-slate-50"} value={fmtIDR(taxResult.net)} disabled /></Field>
        <Field label="TOP Agreement"><input className={inputCls + " bg-slate-50"} value={project.topAgreement} disabled /></Field>

        <Field label="Invoice Number"><input className={inputCls} value={f.invoiceNumber} onChange={(e) => set("invoiceNumber")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Invoicing Date"><input type="date" className={inputCls} value={f.invoicingDate} onChange={(e) => set("invoicingDate")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Payment Due Date"><input type="date" className={inputCls} value={f.paymentDueDate} onChange={(e) => set("paymentDueDate")(e.target.value)} disabled={!canEdit} /></Field>

        <Field label="Paid by Client">
          <select className={selectCls} value={f.paidByClient ? "Yes" : "No"} onChange={(e) => set("paidByClient")(e.target.value === "Yes")} disabled={!canEdit}>
            <option>No</option><option>Yes</option>
          </select>
        </Field>
        <Field label="Bukti Bayar Name"><input className={inputCls} value={f.buktiBayarName} onChange={(e) => set("buktiBayarName")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Bukti Potong Pajak"><input className={inputCls} value={f.buktiPotongPajak} onChange={(e) => set("buktiPotongPajak")(e.target.value)} disabled={!canEdit} /></Field>

        <Field label="Status Rebate to KOL"><input className={inputCls} value={f.statusRebateKOL} onChange={(e) => set("statusRebateKOL")(e.target.value)} disabled={!canEdit} /></Field>
        <Field label="Finance Status"><Select value={f.financeStatus} onChange={set("financeStatus")} options={FINANCE_STATUS} disabled={!canEdit} /></Field>
        <Field label="Sudah Follow Up">
          <select className={selectCls} value={f.sudahFollowUp ? "Yes" : "No"} onChange={(e) => set("sudahFollowUp")(e.target.value === "Yes")} disabled={!canEdit}>
            <option>No</option><option>Yes</option>
          </select>
        </Field>
        <Field label="Finance Notes" span><textarea className={inputCls} rows={2} value={f.financeNotes} onChange={(e) => set("financeNotes")(e.target.value)} disabled={!canEdit} /></Field>
      </div>
      <p className="mt-2 text-xs text-slate-400">Last edited by Finance: {fmtDate(f.lastEditFinance)}</p>
    </div>
  );
}

function PMTab({ project, talents, onUpdateSub, onAddDeliverable, onUpdateDeliverable, canEdit }) {
  if (!project.pm) return <EmptyState text="PM record will be created automatically once the project is Confirmed." />;
  const pm = project.pm;
  const set = (k) => (v) => onUpdateSub("pm", { [k]: v }, "PM / Deliverables");
  const overduePost = isPast(pm.estimatedPostingDueDate) && !["Posted","Completed"].includes(pm.progress);
  const overdueStory = pm.storylineRequired === "Yes" && isPast(pm.storylineDueDate) && pm.storylineStatus !== "Approved";

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ talentId: project.talentIds[0] || "", type: "IG Reels", description: "", dueDate: "", status: "Not Started" });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
        <SectionTitle>PM Tracker {overduePost && <OverdueTag />}</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Product Received"><input className={inputCls} value={pm.productReceived} onChange={(e) => set("productReceived")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Brief"><input className={inputCls} value={pm.brief} onChange={(e) => set("brief")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Progress"><Select value={pm.progress} onChange={set("progress")} options={PROGRESS} disabled={!canEdit} /></Field>

          <Field label="Storyline Required"><Select value={pm.storylineRequired} onChange={set("storylineRequired")} options={STORYLINE_REQUIRED} disabled={!canEdit} /></Field>
          <Field label="Storyline Status">
            <Select value={pm.storylineStatus} onChange={set("storylineStatus")} options={STORYLINE_STATUS} disabled={!canEdit} />
          </Field>
          <Field label="Storyline Due Date">{overdueStory && <OverdueTag />}<input type="date" className={inputCls} value={pm.storylineDueDate} onChange={(e) => set("storylineDueDate")(e.target.value)} disabled={!canEdit} /></Field>

          <Field label="Estimated Execution Date"><input type="date" className={inputCls} value={pm.estimatedExecutionDate} onChange={(e) => set("estimatedExecutionDate")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Estimated Posting Due Date"><input type="date" className={inputCls} value={pm.estimatedPostingDueDate} onChange={(e) => set("estimatedPostingDueDate")(e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Final Posting Date"><input type="date" className={inputCls} value={pm.finalPostingDate} onChange={(e) => set("finalPostingDate")(e.target.value)} disabled={!canEdit} /></Field>

          <Field label="Need Action">
            <select className={selectCls} value={pm.needAction ? "Yes" : "No"} onChange={(e) => set("needAction")(e.target.value === "Yes")} disabled={!canEdit}>
              <option>No</option><option>Yes</option>
            </select>
          </Field>
          <Field label="Notes" span><textarea className={inputCls} rows={2} value={pm.notesProject} onChange={(e) => set("notesProject")(e.target.value)} disabled={!canEdit} /></Field>
        </div>
        <p className="mt-2 text-xs text-slate-400">Last edited by PM: {fmtDate(pm.lastEditedPM)}</p>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
        <SectionTitle right={canEdit && <button className={btnSecondary} onClick={() => setShowAdd((s) => !s)}><Plus size={14} /> Add Deliverable</button>}>
          Deliverables
        </SectionTitle>
        {showAdd && (
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4 rounded-lg bg-slate-50 p-3">
            <select className={selectCls} value={form.talentId} onChange={(e) => setForm((f) => ({ ...f, talentId: e.target.value }))}>
              {project.talentIds.length === 0 && <option value="">No talent assigned</option>}
              {talents.filter((t) => project.talentIds.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={DELIVERABLE_TYPE} />
            <input className={inputCls} placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            <div className="col-span-4 flex justify-end">
              <button className={btnPrimary} onClick={() => { onAddDeliverable({ ...form, projectId: project.id, draftDate: "", revisionDeadline: "", approvalDate: "", postingDate: "", postedLink: "", reportLink: "", notes: "" }); setShowAdd(false); }}>Add</button>
            </div>
          </div>
        )}
        <table className="w-full">
          <thead><tr><Th>Type</Th><Th>Description</Th><Th>Due Date</Th><Th>Status</Th><Th>Posted Link</Th></tr></thead>
          <tbody>
            {project.deliverables.length === 0 && <tr><Td colSpan={5} className="text-slate-400">No deliverables yet.</Td></tr>}
            {project.deliverables.map((d) => {
              const overdue = isPast(d.dueDate) && !["Posted","Completed","Cancelled"].includes(d.status);
              return (
                <tr key={d.id} className="border-t border-slate-100/80">
                  <Td>{d.type}</Td>
                  <Td>{d.description}</Td>
                  <Td>{fmtDate(d.dueDate)} {overdue && <OverdueTag />}</Td>
                  <Td><Select value={d.status} onChange={(v) => onUpdateDeliverable(d.id, { status: v })} options={DELIVERABLE_STATUS} disabled={!canEdit} /></Td>
                  <Td>
                    <input className={inputCls} placeholder="paste posted link" value={d.postedLink} onChange={(e) => onUpdateDeliverable(d.id, { postedLink: e.target.value })} disabled={!canEdit} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocumentsTab({ project, onAddDocument }) {
  const [form, setForm] = useState({ type: "SPK", name: "", link: "", notes: "" });
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm shadow-slate-200/60">
      <SectionTitle>Documents</SectionTitle>
      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-4 rounded-lg bg-slate-50 p-3">
        <Select value={form.type} onChange={(v) => setForm((f) => ({ ...f, type: v }))} options={DOC_TYPE} />
        <input className={inputCls} placeholder="File name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className={inputCls} placeholder="File link / URL" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
        <button className={btnPrimary} onClick={() => { if (form.name) { onAddDocument(form); setForm({ type: "SPK", name: "", link: "", notes: "" }); } }}><Plus size={14} /> Upload</button>
      </div>
      <table className="w-full">
        <thead><tr><Th>Type</Th><Th>Name</Th><Th>Uploaded By</Th><Th>Uploaded At</Th><Th>Link</Th></tr></thead>
        <tbody>
          {project.documents.length === 0 && <tr><Td colSpan={5} className="text-slate-400">No documents yet.</Td></tr>}
          {project.documents.map((d) => (
            <tr key={d.id} className="border-t border-slate-100/80">
              <Td><Badge>{d.type}</Badge></Td>
              <Td>{d.name}</Td>
              <Td>{d.uploadedBy}</Td>
              <Td className="text-slate-400">{fmtDate(d.uploadedAt)}</Td>
              <Td>{d.link ? <a className="text-indigo-600 underline" href={d.link} target="_blank" rel="noreferrer">Open</a> : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center text-sm font-medium text-slate-400 shadow-sm shadow-slate-200/40">
      {text}
    </div>
  );
}
