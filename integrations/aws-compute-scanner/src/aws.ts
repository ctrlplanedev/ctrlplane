import type { KubernetesClusterAPIV1 } from "@ctrlplane/validators/targets";
import type { V1Namespace } from "@kubernetes/client-node";
import { EKSClient, ListClustersCommand } from "@aws-sdk/client-eks";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import { CoreV1Api } from "@kubernetes/client-node";
import handlebars from "handlebars";
import _ from "lodash";
import { SemVer } from "semver";

import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { kubernetesNamespaceV1 } from "@ctrlplane/validators/targets";

import { connectToCluster, createEksClient } from "./aws-connect.js";
import { env } from "./config.js";
import { omitNullUndefined } from "./utils.js";

export const eksLogger = logger.child({ label: "eks" });

const clusterClient = new EKSClient({});

const getClusters = async () => {
  const eksClient = createEksClient();

  // Optional: Check AWS identity for verification
  const stsClient = new STSClient({ region: env.AWS_REGION });
  const identity = await stsClient.send(new GetCallerIdentityCommand({}));
  console.log("Authenticated AWS Identity:", identity);

  // List EKS clusters
  const command = new ListClustersCommand({});
  const response = await eksClient.send(command);
  return response.clusters;
};

// const clusterNameTemplate = handlebars.compile(env.CTRLPLANE_AWS_TARGET_NAME);
// const targetClusterName = (cluster: eks.Cluster) =>
//   clusterNameTemplate({ cluster, projectId: env.AWS_ACCOUNT_ID });

// // const namespaceNameTemplate = handlebars.compile(
// //   env.CTRLPLANE_GKE_NAMESPACE_TARGET_NAME,
// // );
// const targetNamespaceName = (
//   namespace: V1Namespace,
//   cluster: google.container.v1.ICluster,
// ) =>
//   namespaceNameTemplate({
//     namespace,
//     cluster,
//     projectId: env.GOOGLE_PROJECT_ID,
//   });

export const getKubernetesClusters = async (): Promise<
  Array<{
    cluster: eks.Cluster;
    target: KubernetesClusterAPIV1;
  }>
> => {
  eksLogger.info("Scanning AWS EKS clusters");
  const clusters = (await getClusters()) ?? [];
  console.log(clusters);
  // return clusters.map((cluster) => {
  //   const masterVersion = new SemVer(cluster.currentMasterVersion ?? "0");
  //   const nodeVersion = new SemVer(cluster.currentNodeVersion ?? "0");
  //   const autoscaling = String(
  //     cluster.autoscaling?.enableNodeAutoprovisioning ?? false,
  //   );

  //   const appUrl = `https://console.cloud.google.com/kubernetes/clusters/details/${cluster.location}/${cluster.name}/details?project=${env.GOOGLE_PROJECT_ID}`;

  //   return {
  //     cluster,
  //     target: {
  //       version: "kubernetes/v1",
  //       kind: "ClusterAPI",
  //       name: targetClusterName(cluster),
  //       identifier: `${env.AWS_ACCOUNT_ID}/${cluster.name}`,
  //       config: {
  //         name: cluster.name!,
  //         auth: {
  //           method: "aws/eks",
  //           project: env.AWS_ACCOUNT_ID,
  //           location: cluster.location!,
  //           clusterName: cluster.name!,
  //         },
  //         status: cluster.status?.toString() ?? "STATUS_UNSPECIFIED",
  //         server: {
  //           certificateAuthorityData: cluster.masterAuth?.clusterCaCertificate,
  //           endpoint: `https://${cluster.endpoint}`,
  //         },
  //       },
  //       metadata: omitNullUndefined({
  //         [ReservedMetadataKey.Links]: JSON.stringify({
  //           "Google Console": appUrl,
  //         }),
  //         [ReservedMetadataKey.ExternalId]: cluster.id ?? "",
  //         [ReservedMetadataKey.KubernetesFlavor]: "gke",
  //         [ReservedMetadataKey.KubernetesVersion]:
  //           masterVersion.version.split("-")[0],

  //         "google/self-link": cluster.selfLink,
  //         "google/location": cluster.location,
  //         "google/autopilot": String(cluster.autopilot?.enabled ?? false),

  //         "kubernetes/status": cluster.status,
  //         "kubernetes/node-count": String(cluster.currentNodeCount ?? 0),

  //         "kubernetes/master-version": masterVersion.version,
  //         "kubernetes/master-version-major": String(masterVersion.major),
  //         "kubernetes/master-version-minor": String(masterVersion.minor),
  //         "kubernetes/master-version-patch": String(masterVersion.patch),

  //         "kubernetes/node-version": nodeVersion.version,
  //         "kubernetes/node-version-major": String(nodeVersion.major),
  //         "kubernetes/node-version-minor": String(nodeVersion.minor),
  //         "kubernetes/node-version-patch": String(nodeVersion.patch),

  //         "kubernetes/autoscaling-enabled": autoscaling,

  //         ...(cluster.resourceLabels ?? {}),
  //       }),
  //     },
  //   };
  // });
};

// // export const getKubernetesNamespace = async (
// //   clusters: Array<{
// //     cluster: google.container.v1.ICluster;
// //     target: KubernetesClusterAPIV1;
// //   }>,
// // ) => {
// //   gkeLogger.info("Coverting GKE clusters to namespaces");

// //   const namespaceTargets = clusters.map(async ({ cluster, target }) => {
// //     const kubeConfig = await connectToCluster(
// //       clusterClient,
// //       env.GOOGLE_PROJECT_ID,
// //       cluster.name!,
// //       cluster.location!,
// //     );
// //     const k8sApi = kubeConfig.makeApiClient(CoreV1Api);
// //     const namespaces = await k8sApi
// //       .listNamespace()
// //       .then((r) => r.body.items.filter((n) => n.metadata != null));
// //     return namespaces
// //       .filter(
// //         (n) =>
// //           !env.CTRLPLANE_GKE_NAMESPACE_IGNORE.split(",").includes(
// //             n.metadata!.name!,
// //           ),
// //       )
// //       .map((n) =>
// //         kubernetesNamespaceV1.parse(
// //           _.merge(_.cloneDeep(target), {
// //             kind: "Namespace",
// //             name: targetNamespaceName(n, cluster),
// //             identifier: `${env.GOOGLE_PROJECT_ID}/${cluster.name}/${n.metadata!.name}`,
// //             config: { namespace: n.metadata!.name },
// //             metadata: {
// //               "ctrlplane/parent-target-identifier": target.identifier,
// //               "kubernetes/namespace": n.metadata!.name,
// //               ...n.metadata?.labels,
// //             },
// //           }),
// //         ),
// //       );
// //   });

// //   return Promise.all(namespaceTargets).then((v) => v.flat());
// // };
