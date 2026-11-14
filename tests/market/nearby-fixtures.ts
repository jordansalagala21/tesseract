import type { NearbyContext } from "@/lib/data/nearby";

/**
 * getNearbyContext(1018657, 1000) as DATA-07 returned it from the kit on 2026-11-14, abridged to
 * the fields AI-04 reads. Real counts, so the tests pin real behaviour: every published rent
 * near 2600 Travis is TripleNet Office, and no retail space publishes a rate.
 */
export const TRAVIS_1000: NearbyContext = {
  propertyId: 1018657,
  radiusMeters: 1000,
  propertiesInRadius: 31,
  propertyIds: [],
  comparableSpaces: {
    count: 54,
    withPublishedRate: 14,
    askingRentPsfYear: { min: 18, median: 18, max: 18 },
    rentGroups: [
      { serviceType: "FullService", spaceUse: "Medical", count: 32, withPublishedRate: 0, askingRentPsfYear: { min: null, median: null, max: null } },
      { serviceType: "TripleNet", spaceUse: "Office", count: 14, withPublishedRate: 14, askingRentPsfYear: { min: 18, median: 18, max: 18 } },
      { serviceType: "ToBeDetermined", spaceUse: "Retail", count: 3, withPublishedRate: 0, askingRentPsfYear: { min: null, median: null, max: null } },
      { serviceType: "Negotiable", spaceUse: "OfficeMedical", count: 2, withPublishedRate: 0, askingRentPsfYear: { min: null, median: null, max: null } },
      { serviceType: "TripleNet", spaceUse: "OfficeMedical", count: 1, withPublishedRate: 0, askingRentPsfYear: { min: null, median: null, max: null } },
      { serviceType: "TripleNet", spaceUse: "OfficeRetail", count: 1, withPublishedRate: 0, askingRentPsfYear: { min: null, median: null, max: null } },
      { serviceType: "ToBeDetermined", spaceUse: "Medical", count: 1, withPublishedRate: 0, askingRentPsfYear: { min: null, median: null, max: null } },
    ],
    serviceTypes: [
      { serviceType: "FullService", count: 32 },
      { serviceType: "TripleNet", count: 16 },
      { serviceType: "ToBeDetermined", count: 4 },
      { serviceType: "Negotiable", count: 2 },
    ],
    spaceUses: [
      { spaceUse: "Medical", count: 33 },
      { spaceUse: "Office", count: 14 },
      { spaceUse: "Retail", count: 3 },
      { spaceUse: "OfficeMedical", count: 3 },
      { spaceUse: "OfficeRetail", count: 1 },
    ],
    propertyIds: [],
  },
  nearbyTenants: {
    count: 146,
    byIndustry: [
      { industry: "Unknown", count: 38 },
      { industry: "HealthCareAndSocialAssistance", count: 18 },
      { industry: "ProfessionalScientificAndTechnicalServices", count: 17 },
      { industry: "AccommodationAndFoodServices", count: 15 },
      { industry: "PersonalServices", count: 13 },
      { industry: "RealEstate", count: 12 },
      { industry: "PublicAdministration", count: 10 },
      { industry: "RetailersOrWholesalers", count: 8 },
      { industry: "AgriculturalOrMiningOrUtilities", count: 3 },
      { industry: "ArtsEntertainmentAndRecreation", count: 2 },
      { industry: "FinancialInstitutions", count: 2 },
      { industry: "AdministrativeAndSupportServices", count: 1 },
      { industry: "EducationalServices", count: 1 },
      { industry: "Information", count: 1 },
      { industry: "ManagementOfCompaniesAndEnterprises", count: 1 },
      { industry: "RentalAndLeasingServices", count: 1 },
      { industry: "Transportation", count: 1 },
      { industry: "WasteManagementAndRemediationServices", count: 1 },
      { industry: "Wholesaler", count: 1 },
    ],
  },
  saleComps: { count: 41, withDisclosedPrice: 15 },
};

/** getNearbyContext(5528958, 1500) rent groups (800 12th St, LA): several rated groups incl. Retail. */
export const LA_GROUPS: NearbyContext["comparableSpaces"]["rentGroups"] = [
  { serviceType: "FullService", spaceUse: "Office", count: 20, withPublishedRate: 20, askingRentPsfYear: { min: 15, median: 17.7, max: 19.799999999999997 } },
  { serviceType: "ModifiedGross", spaceUse: "Office", count: 15, withPublishedRate: 15, askingRentPsfYear: { min: 12, median: 18, max: 18 } },
  { serviceType: "FullService", spaceUse: "Retail", count: 1, withPublishedRate: 1, askingRentPsfYear: { min: 19.200000000000003, median: 19.200000000000003, max: 19.200000000000003 } },
  { serviceType: "ModifiedGross", spaceUse: "Retail", count: 1, withPublishedRate: 1, askingRentPsfYear: { min: 28.200000000000003, median: 28.200000000000003, max: 28.200000000000003 } },
];

export const EMPTY: NearbyContext = {
  propertyId: 42,
  radiusMeters: 500,
  propertiesInRadius: 0,
  propertyIds: [],
  comparableSpaces: { count: 0, withPublishedRate: 0, askingRentPsfYear: { min: null, median: null, max: null }, rentGroups: [], serviceTypes: [], spaceUses: [], propertyIds: [] },
  nearbyTenants: { count: 0, byIndustry: [] },
  saleComps: { count: 0, withDisclosedPrice: 0 },
};
