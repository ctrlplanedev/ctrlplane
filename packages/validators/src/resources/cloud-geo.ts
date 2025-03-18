/**
 * Cloud provider region geographic data
 * Contains latitude, longitude, and timezone information for cloud provider regions
 */

export type CloudRegionGeoData = {
  timezone: string;
  latitude: number;
  longitude: number;
};

export type CloudProviderRegionMap = Record<string, CloudRegionGeoData>;

/**
 * Complete geographic data for all cloud provider regions
 */
export const cloudRegionsGeo: Record<string, CloudProviderRegionMap> = {
  azure: {
    westus: {
      timezone: "UTC-8",
      latitude: 37.783,
      longitude: -122.417,
    },
    westus2: {
      timezone: "UTC-8",
      latitude: 47.233,
      longitude: -119.852,
    },
    westus3: {
      timezone: "UTC-8",
      latitude: 33.448,
      longitude: -112.074,
    },
    westusstage: {
      timezone: "UTC-8",
      latitude: 37.783,
      longitude: -122.417,
    },
    westus2stage: {
      timezone: "UTC-8",
      latitude: 47.233,
      longitude: -119.852,
    },
    westcentralus: {
      timezone: "UTC-7",
      latitude: 40.89,
      longitude: -110.234,
    },
    southcentralus: {
      timezone: "UTC-6",
      latitude: 29.424,
      longitude: -98.494,
    },
    centralus: {
      timezone: "UTC-6",
      latitude: 41.691,
      longitude: -93.742,
    },
    mexicocentral: {
      timezone: "UTC-6",
      latitude: 19.432,
      longitude: -99.133,
    },
    northcentralus: {
      timezone: "UTC-6",
      latitude: 41.986,
      longitude: -87.984,
    },
    centralusstage: {
      timezone: "UTC-6",
      latitude: 41.691,
      longitude: -93.742,
    },
    northcentralusstage: {
      timezone: "UTC-6",
      latitude: 41.986,
      longitude: -87.984,
    },
    southcentralusstage: {
      timezone: "UTC-6",
      latitude: 29.424,
      longitude: -98.494,
    },
    southcentralusstg: {
      timezone: "UTC-6",
      latitude: 29.424,
      longitude: -98.494,
    },
    centraluseuap: {
      timezone: "UTC-6",
      latitude: 41.691,
      longitude: -93.742,
    },
    eastus: {
      timezone: "UTC-5",
      latitude: 37.3719,
      longitude: -79.8164,
    },
    eastus2: {
      timezone: "UTC-5",
      latitude: 36.6681,
      longitude: -78.3889,
    },
    canadacentral: {
      timezone: "UTC-5",
      latitude: 43.653,
      longitude: -79.383,
    },
    canadaeast: {
      timezone: "UTC-5",
      latitude: 46.8139,
      longitude: -71.2082,
    },
    eastusstage: {
      timezone: "UTC-5",
      latitude: 37.3719,
      longitude: -79.8164,
    },
    eastus2stage: {
      timezone: "UTC-5",
      latitude: 36.6681,
      longitude: -78.3889,
    },
    eastus2euap: {
      timezone: "UTC-5",
      latitude: 36.6681,
      longitude: -78.3889,
    },
    brazilsouth: {
      timezone: "UTC-3",
      latitude: -23.55,
      longitude: -46.633,
    },
    brazilsoutheast: {
      timezone: "UTC-3",
      latitude: -22.9068,
      longitude: -43.1729,
    },
    northeurope: {
      timezone: "UTC+0",
      latitude: 53.3478,
      longitude: -6.2597,
    },
    uksouth: {
      timezone: "UTC+0",
      latitude: 50.941,
      longitude: -0.799,
    },
    ukwest: {
      timezone: "UTC+0",
      latitude: 53.427,
      longitude: -3.084,
    },
    swedencentral: {
      timezone: "UTC+1",
      latitude: 60.6749,
      longitude: 17.1413,
    },
    westeurope: {
      timezone: "UTC+1",
      latitude: 52.3667,
      longitude: 4.9,
    },
    francecentral: {
      timezone: "UTC+1",
      latitude: 46.3772,
      longitude: 2.373,
    },
    germanywestcentral: {
      timezone: "UTC+1",
      latitude: 50.11,
      longitude: 8.682,
    },
    italynorth: {
      timezone: "UTC+1",
      latitude: 45.464,
      longitude: 9.191,
    },
    norwayeast: {
      timezone: "UTC+1",
      latitude: 59.913,
      longitude: 10.752,
    },
    polandcentral: {
      timezone: "UTC+1",
      latitude: 52.232,
      longitude: 21.008,
    },
    spaincentral: {
      timezone: "UTC+1",
      latitude: 40.383,
      longitude: -3.717,
    },
    switzerlandnorth: {
      timezone: "UTC+1",
      latitude: 47.451,
      longitude: 8.582,
    },
    francesouth: {
      timezone: "UTC+1",
      latitude: 43.6044,
      longitude: 1.4442,
    },
    germanynorth: {
      timezone: "UTC+1",
      latitude: 53.073,
      longitude: 8.806,
    },
    norwaywest: {
      timezone: "UTC+1",
      latitude: 58.969,
      longitude: 5.733,
    },
    switzerlandwest: {
      timezone: "UTC+1",
      latitude: 46.204,
      longitude: 6.143,
    },
    southafricanorth: {
      timezone: "UTC+2",
      latitude: -25.731,
      longitude: 28.218,
    },
    israelcentral: {
      timezone: "UTC+2",
      latitude: 31.768,
      longitude: 35.216,
    },
    southafricawest: {
      timezone: "UTC+2",
      latitude: -33.927,
      longitude: 18.424,
    },
    qatarcentral: {
      timezone: "UTC+3",
      latitude: 25.286,
      longitude: 51.534,
    },
    uaenorth: {
      timezone: "UTC+4",
      latitude: 25.266,
      longitude: 55.307,
    },
    uaecentral: {
      timezone: "UTC+4",
      latitude: 24.466,
      longitude: 54.366,
    },
    centralindia: {
      timezone: "UTC+5:30",
      latitude: 18.5822,
      longitude: 73.9091,
    },
    jioindiawest: {
      timezone: "UTC+5:30",
      latitude: 19.088,
      longitude: 72.868,
    },
    jioindiacentral: {
      timezone: "UTC+5:30",
      latitude: 21.146,
      longitude: 79.089,
    },
    southindia: {
      timezone: "UTC+5:30",
      latitude: 12.968,
      longitude: 80.169,
    },
    westindia: {
      timezone: "UTC+5:30",
      latitude: 19.088,
      longitude: 72.868,
    },
    southeastasia: {
      timezone: "UTC+7",
      latitude: 1.283,
      longitude: 103.833,
    },
    eastasia: {
      timezone: "UTC+8",
      latitude: 22.267,
      longitude: 114.188,
    },
    japaneast: {
      timezone: "UTC+9",
      latitude: 35.682,
      longitude: 139.752,
    },
    koreacentral: {
      timezone: "UTC+9",
      latitude: 37.566,
      longitude: 126.978,
    },
    japanwest: {
      timezone: "UTC+9",
      latitude: 34.694,
      longitude: 135.502,
    },
    koreasouth: {
      timezone: "UTC+9",
      latitude: 35.18,
      longitude: 129.076,
    },
    australiaeast: {
      timezone: "UTC+10",
      latitude: -33.855,
      longitude: 151.216,
    },
    australiacentral: {
      timezone: "UTC+10",
      latitude: -35.307,
      longitude: 149.124,
    },
    australiacentral2: {
      timezone: "UTC+10",
      latitude: -35.307,
      longitude: 149.124,
    },
    australiasoutheast: {
      timezone: "UTC+10",
      latitude: -37.814,
      longitude: 144.963,
    },
    newzealandnorth: {
      timezone: "UTC+12",
      latitude: -36.848,
      longitude: 174.763,
    },
  },
  gcp: {
    "us-west1": {
      timezone: "UTC-8",
      latitude: 45.601,
      longitude: -121.185,
    },
    "us-west2": {
      timezone: "UTC-8",
      latitude: 34.0522,
      longitude: -118.244,
    },
    "us-west3": {
      timezone: "UTC-8",
      latitude: 40.759,
      longitude: -111.888,
    },
    "us-west4": {
      timezone: "UTC-8",
      latitude: 36.175,
      longitude: -115.137,
    },
    "northamerica-west1": {
      timezone: "UTC-8",
      latitude: 49.246,
      longitude: -123.116,
    },
    "us-central1": {
      timezone: "UTC-6",
      latitude: 41.261,
      longitude: -95.861,
    },
    "us-central2": {
      timezone: "UTC-6",
      latitude: 41.261,
      longitude: -95.861,
    },
    "us-east1": {
      timezone: "UTC-5",
      latitude: 33.757,
      longitude: -84.387,
    },
    "us-east4": {
      timezone: "UTC-5",
      latitude: 39.002,
      longitude: -77.459,
    },
    "us-east5": {
      timezone: "UTC-5",
      latitude: 39.96,
      longitude: -75.606,
    },
    "northamerica-northeast1": {
      timezone: "UTC-5",
      latitude: 45.501,
      longitude: -73.567,
    },
    "northamerica-northeast2": {
      timezone: "UTC-5",
      latitude: 43.654,
      longitude: -79.387,
    },
    "us-south1": {
      timezone: "UTC-5",
      latitude: 32.779,
      longitude: -96.802,
    },
    "southamerica-west1": {
      timezone: "UTC-4",
      latitude: -33.447,
      longitude: -70.673,
    },
    "southamerica-east1": {
      timezone: "UTC-3",
      latitude: -23.551,
      longitude: -46.633,
    },
    "europe-west2": {
      timezone: "UTC+0",
      latitude: 51.507,
      longitude: -0.127,
    },
    "europe-west10": {
      timezone: "UTC+0",
      latitude: 51.507,
      longitude: -0.127,
    },
    "europe-west12": {
      timezone: "UTC+0",
      latitude: 51.507,
      longitude: -0.127,
    },
    "europe-west1": {
      timezone: "UTC+1",
      latitude: 50.448,
      longitude: 3.818,
    },
    "europe-west3": {
      timezone: "UTC+1",
      latitude: 50.11,
      longitude: 8.682,
    },
    "europe-west4": {
      timezone: "UTC+1",
      latitude: 53.439,
      longitude: 6.836,
    },
    "europe-west6": {
      timezone: "UTC+1",
      latitude: 47.366,
      longitude: 8.55,
    },
    "europe-west8": {
      timezone: "UTC+1",
      latitude: 45.464,
      longitude: 9.191,
    },
    "europe-west9": {
      timezone: "UTC+1",
      latitude: 48.857,
      longitude: 2.352,
    },
    "europe-central2": {
      timezone: "UTC+1",
      latitude: 52.23,
      longitude: 21.012,
    },
    "europe-north1": {
      timezone: "UTC+1",
      latitude: 60.566,
      longitude: 27.19,
    },
    "europe-southwest1": {
      timezone: "UTC+1",
      latitude: 40.416,
      longitude: -3.702,
    },
    "africa-south1": {
      timezone: "UTC+2",
      latitude: -26.204,
      longitude: 28.047,
    },
    "me-west1": {
      timezone: "UTC+3",
      latitude: 32.087,
      longitude: 34.789,
    },
    "me-central1": {
      timezone: "UTC+3",
      latitude: 26.267,
      longitude: 50.639,
    },
    "me-central2": {
      timezone: "UTC+3",
      latitude: 25.268,
      longitude: 51.609,
    },
    "asia-south1": {
      timezone: "UTC+5:30",
      latitude: 19.076,
      longitude: 72.877,
    },
    "asia-south2": {
      timezone: "UTC+5:30",
      latitude: 28.644,
      longitude: 77.216,
    },
    "asia-southeast1": {
      timezone: "UTC+7",
      latitude: 1.352,
      longitude: 103.82,
    },
    "asia-southeast2": {
      timezone: "UTC+7",
      latitude: -6.175,
      longitude: 106.827,
    },
    "asia-east1": {
      timezone: "UTC+8",
      latitude: 24.052,
      longitude: 120.516,
    },
    "asia-east2": {
      timezone: "UTC+8",
      latitude: 22.396,
      longitude: 114.109,
    },
    "asia-northeast1": {
      timezone: "UTC+9",
      latitude: 35.689,
      longitude: 139.692,
    },
    "asia-northeast2": {
      timezone: "UTC+9",
      latitude: 34.694,
      longitude: 135.502,
    },
    "asia-northeast3": {
      timezone: "UTC+9",
      latitude: 37.566,
      longitude: 126.978,
    },
    "australia-southeast1": {
      timezone: "UTC+10",
      latitude: -33.868,
      longitude: 151.207,
    },
    "australia-southeast2": {
      timezone: "UTC+10",
      latitude: -37.814,
      longitude: 144.963,
    },
  },
  aws: {
    "us-west-1": {
      timezone: "UTC-8",
      latitude: 37.7749,
      longitude: -122.4194,
    },
    "us-west-2": {
      timezone: "UTC-8",
      latitude: 45.8491,
      longitude: -119.6885,
    },
    "us-gov-west-1": {
      timezone: "UTC-8",
      latitude: 37.7749,
      longitude: -122.4194,
    },
    "ca-west-1": {
      timezone: "UTC-8",
      latitude: 49.246,
      longitude: -123.116,
    },
    "us-east-1": {
      timezone: "UTC-5",
      latitude: 39.0437,
      longitude: -77.4875,
    },
    "us-east-2": {
      timezone: "UTC-5",
      latitude: 40.4173,
      longitude: -82.9071,
    },
    "us-gov-east-1": {
      timezone: "UTC-5",
      latitude: 39.0437,
      longitude: -77.4875,
    },
    "ca-central-1": {
      timezone: "UTC-5",
      latitude: 45.5017,
      longitude: -73.5673,
    },
    "sa-east-1": {
      timezone: "UTC-3",
      latitude: -23.5505,
      longitude: -46.6333,
    },
    "eu-west-1": {
      timezone: "UTC+0",
      latitude: 53.3498,
      longitude: -6.2603,
    },
    "eu-west-2": {
      timezone: "UTC+0",
      latitude: 51.5074,
      longitude: -0.1278,
    },
    "eu-west-3": {
      timezone: "UTC+1",
      latitude: 48.8566,
      longitude: 2.3522,
    },
    "eu-north-1": {
      timezone: "UTC+1",
      latitude: 59.3293,
      longitude: 18.0686,
    },
    "eu-central-1": {
      timezone: "UTC+1",
      latitude: 50.1109,
      longitude: 8.6821,
    },
    "eu-central-2": {
      timezone: "UTC+1",
      latitude: 47.3769,
      longitude: 8.5417,
    },
    "eu-south-1": {
      timezone: "UTC+1",
      latitude: 45.4642,
      longitude: 9.19,
    },
    "eu-south-2": {
      timezone: "UTC+1",
      latitude: 39.4699,
      longitude: -0.3763,
    },
    "af-south-1": {
      timezone: "UTC+2",
      latitude: -33.9249,
      longitude: 18.4241,
    },
    "il-central-1": {
      timezone: "UTC+2",
      latitude: 31.0461,
      longitude: 34.8516,
    },
    "me-south-1": {
      timezone: "UTC+3",
      latitude: 26.0667,
      longitude: 50.5577,
    },
    "me-central-1": {
      timezone: "UTC+3",
      latitude: 24.4667,
      longitude: 54.3667,
    },
    "ap-south-1": {
      timezone: "UTC+5:30",
      latitude: 19.076,
      longitude: 72.8777,
    },
    "ap-south-2": {
      timezone: "UTC+5:30",
      latitude: 12.9716,
      longitude: 77.5946,
    },
    "ap-southeast-3": {
      timezone: "UTC+7",
      latitude: -6.2088,
      longitude: 106.8456,
    },
    "ap-southeast-4": {
      timezone: "UTC+7",
      latitude: 13.7563,
      longitude: 100.5018,
    },
    "ap-southeast-1": {
      timezone: "UTC+8",
      latitude: 1.3521,
      longitude: 103.8198,
    },
    "ap-east-1": {
      timezone: "UTC+8",
      latitude: 22.3193,
      longitude: 114.1694,
    },
    "ap-northeast-1": {
      timezone: "UTC+9",
      latitude: 35.6762,
      longitude: 139.6503,
    },
    "ap-northeast-2": {
      timezone: "UTC+9",
      latitude: 37.5665,
      longitude: 126.978,
    },
    "ap-northeast-3": {
      timezone: "UTC+9",
      latitude: 34.6937,
      longitude: 135.5022,
    },
    "ap-southeast-2": {
      timezone: "UTC+10",
      latitude: -33.8688,
      longitude: 151.2093,
    },
  },
};

/**
 * Get timezone for a cloud provider region
 * @param provider Cloud provider (aws, gcp, azure)
 * @param region Region name
 * @returns timezone string or null if not found
 */
export function getRegionTimezone(
  provider: string,
  region: string,
): string | null {
  return cloudRegionsGeo[provider]?.[region]?.timezone ?? null;
}

/**
 * Get geographic coordinates for a cloud provider region
 * @param provider Cloud provider (aws, gcp, azure)
 * @param region Region name
 * @returns [latitude, longitude] or null if not found
 */
export function getRegionCoordinates(
  provider: string,
  region: string,
): [number, number] | null {
  const data = cloudRegionsGeo[provider]?.[region];
  if (!data) return null;
  return [data.latitude, data.longitude];
}
