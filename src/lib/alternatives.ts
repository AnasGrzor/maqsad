import type { Extraction } from "./schema";

export type Alternative = { name: string; url: string; note: string };

// Hand-checked official starting points, so a suspicious document still leaves the student
// somewhere safe to go. Static on purpose: no model calls. Every URL was opened and confirmed
// official in October 2026; re-check them when editing this list.
const ALTERNATIVES: Record<Extraction["doc_type"], { tip: string; links: Alternative[] }> = {
  scholarship_offer: {
    tip: "Apply on the scholarship's own website, and never pay a consultant or a person's account to secure one.",
    links: [
      {
        name: "HEC scholarships",
        url: "https://www.hec.gov.pk/english/scholarshipsgrants/Pages/default.aspx",
        note: "Scholarships HEC runs or nominates Pakistani students for",
      },
      {
        name: "Chinese Government Scholarship (HEC)",
        url: "https://www.hec.gov.pk/english/scholarshipsgrants/lao/CGSP/Pages/default.aspx",
        note: "HEC is the nominating agency for Pakistani applicants",
      },
      { name: "Chevening", url: "https://www.chevening.org/", note: "UK government scholarships for a master's" },
      { name: "Fulbright (USEFP)", url: "https://www.usefp.org/", note: "Fulbright and other US exchange programmes in Pakistan" },
      { name: "DAAD", url: "https://www.daad.de/en/", note: "German scholarships and study programmes" },
      {
        name: "Commonwealth Scholarships",
        url: "https://cscuk.fcdo.gov.uk/",
        note: "Commonwealth Scholarship Commission in the UK",
      },
      {
        name: "Erasmus Mundus",
        url: "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en",
        note: "EU catalogue of funded joint master's programmes",
      },
      { name: "Türkiye Bursları", url: "https://www.turkiyeburslari.gov.tr/", note: "Turkish government scholarships" },
      { name: "Stipendium Hungaricum", url: "https://stipendiumhungaricum.hu/", note: "Hungarian government scholarships" },
    ],
  },
  university_offer: {
    tip: "Apply through the university's own website or the official portal below, and pay fees only to the university.",
    links: [
      { name: "UCAS", url: "https://www.ucas.com/", note: "Official undergraduate applications to UK universities" },
      {
        name: "UK register of student sponsors",
        url: "https://www.gov.uk/government/publications/register-of-licensed-sponsors-students",
        note: "Institutions allowed to sponsor a UK Student visa",
      },
      { name: "EduCanada", url: "https://www.educanada.ca/", note: "Government of Canada guide to studying in Canada" },
      { name: "Study Australia", url: "https://www.studyaustralia.gov.au/", note: "Australian government course search" },
      {
        name: "CRICOS",
        url: "https://cricos.education.gov.au/",
        note: "Australian institutions and courses open to overseas students",
      },
      { name: "EducationUSA", url: "https://educationusa.state.gov/", note: "US State Department guide to US universities" },
    ],
  },
  agent_message: {
    tip: "Universities that work with consultants list them on their own international pages. Open the university's site yourself, not from the consultant's link, and check the consultant is named there.",
    links: [
      { name: "Fulbright (USEFP)", url: "https://www.usefp.org/", note: "Free EducationUSA advising in Pakistan" },
      { name: "UCAS", url: "https://www.ucas.com/", note: "Apply to UK universities yourself, no consultant needed" },
      { name: "EduCanada", url: "https://www.educanada.ca/", note: "Government of Canada guide to studying in Canada" },
      { name: "Study Australia", url: "https://www.studyaustralia.gov.au/", note: "Australian government course search" },
    ],
  },
  visa_letter: {
    tip: "Only an embassy or immigration department issues visas. Apply and pay through its own website.",
    links: [
      { name: "UK Student visa", url: "https://www.gov.uk/student-visa", note: "GOV.UK" },
      {
        name: "Study in Canada",
        url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada.html",
        note: "Immigration, Refugees and Citizenship Canada",
      },
      { name: "Australian visas", url: "https://immi.homeaffairs.gov.au/", note: "Department of Home Affairs" },
      { name: "US Embassy in Pakistan", url: "https://pk.usembassy.gov/", note: "US visas for Pakistani applicants" },
      { name: "German Mission in Pakistan", url: "https://pakistan.diplo.de/", note: "German visas for Pakistani applicants" },
      {
        name: "VFS Global",
        url: "https://www.vfsglobal.com/",
        note: "Takes applications for some embassies; it doesn't decide visas",
      },
    ],
  },
  degree_or_transcript: {
    tip: "Verify a degree with the body that attests it, not with a contact given in the document.",
    links: [
      {
        name: "HEC degree attestation",
        url: "https://www.hec.gov.pk/english/services/students/DAS/Pages/default.aspx",
        note: "Attestation of Pakistani university degrees",
      },
      {
        name: "HEC recognised universities",
        url: "https://www.hec.gov.pk/english/universities/Pages/recognised.aspx",
        note: "Universities and degree-awarding institutes HEC recognises",
      },
      { name: "IBCC", url: "https://ibcc.edu.pk/", note: "Matric and intermediate certificates and equivalence" },
    ],
  },
  job_offer: {
    tip: "For jobs abroad, recruit only through a licensed overseas employment promoter and get a receipt for any payment.",
    links: [
      {
        name: "Bureau of Emigration",
        url: "https://beoe.gov.pk/",
        note: "Its list of OEPs shows every licensed overseas recruiter",
      },
      { name: "OEC", url: "https://www.oec.gov.pk/", note: "Government-owned overseas recruitment agency" },
      { name: "FPSC", url: "https://www.fpsc.gov.pk/", note: "Federal government jobs in Pakistan" },
    ],
  },
  internship: {
    tip: "For a company internship, find the company's careers page by searching its name yourself, and apply there.",
    links: [
      {
        name: "PM Youth Programme",
        url: "https://pmyp.gov.pk/",
        note: "Digital Youth Hub: government career guidance and opportunities",
      },
      {
        name: "State Bank internship",
        url: "https://archive.sbp.org.pk/careers/sumintern.asp",
        note: "State Bank of Pakistan's yearly summer internship",
      },
    ],
  },
  other: { tip: "", links: [] },
};

export function alternativesFor(docType: Extraction["doc_type"]) {
  return ALTERNATIVES[docType];
}
