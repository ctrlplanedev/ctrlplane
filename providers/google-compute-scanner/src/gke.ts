import type { KubernetesClusterAPIV1 } from "@ctrlplane/validators/targets";
import type { google } from "@google-cloud/container/build/protos/protos.js";
import type { V1Namespace } from "@kubernetes/client-node";
import Container from "@google-cloud/container";
import { CoreV1Api } from "@kubernetes/client-node";
import handlebars from "handlebars";
import _ from "lodash";
import { SemVer } from "semver";

import { logger } from "@ctrlplane/logger";
import { kubernetesNamespaceV1 } from "@ctrlplane/validators/targets";

import { env } from "./config.js";
import { connectToCluster } from "./gke-connect.js";
import { omitNullUndefined } from "./utils.js";

export const gkeLogger = logger.child({ label: "gke" });

const clusterClient = new Container.v1.ClusterManagerClient();

const getClusters = async () => {
  const request = { parent: `projects/${env.GOOGLE_PROJECT_ID}/locations/-` };
  const [response] = await clusterClient.listClusters(request);
  const { clusters } = response;
  return clusters;
};

const clusterNameTemplate = handlebars.compile(env.CTRLPLANE_GKE_TARGET_NAME);
const targetClusterName = (cluster: google.container.v1.ICluster) =>
  clusterNameTemplate({ cluster, projectId: env.GOOGLE_PROJECT_ID });

const namespaceNameTemplate = handlebars.compile(
  env.CTRLPLANE_GKE_NAMESPACE_TARGET_NAME,
);
const targetNamespaceName = (
  namespace: V1Namespace,
  cluster: google.container.v1.ICluster,
) =>
  namespaceNameTemplate({
    namespace,
    cluster,
    projectId: env.GOOGLE_PROJECT_ID,
  });

export const getKubernetesClusters = async (): Promise<
  Array<{
    cluster: google.container.v1.ICluster;
    target: KubernetesClusterAPIV1;
  }>
> => {
  gkeLogger.info("Scanning Google Cloud GKE clusters");
  const clusters = (await getClusters()) ?? [];
  return clusters.map((cluster) => {
    const masterVersion = new SemVer(cluster.currentMasterVersion ?? "0");
    const nodeVersion = new SemVer(cluster.currentNodeVersion ?? "0");
    const autoscaling = String(
      cluster.autoscaling?.enableNodeAutoprovisioning ?? false,
    );

    const appUrl = `https://console.cloud.google.com/kubernetes/clusters/details/${cluster.location}/${cluster.name}/details?project=${env.GOOGLE_PROJECT_ID}`;

    return {
      cluster,
      target: {
        version: "kubernetes/v1",
        kind: "ClusterAPI",
        name: targetClusterName(cluster),
        identifier: `${env.GOOGLE_PROJECT_ID}/${cluster.name}`,
        config: {
          name: cluster.name!,
          server: {
            certificateAuthorityData:
              cluster.masterAuth?.clusterCaCertificate ?? "",
            endpoint: `https://${cluster.endpoint}`,
          },
        },
        metadata: omitNullUndefined({
          "ctrlplane/links": JSON.stringify({ "Google Console": appUrl }),
          "ctrlplane/external-id": cluster.id ?? "",

          "kubernetes/flavor": "gke",
          "kubernetes/version": masterVersion.version,

          "kubernetes/status": cluster.status,
          "kubernetes/node-count": String(cluster.currentNodeCount ?? 0),

          "kubernetes/master-version": masterVersion.version,
          "kubernetes/master-version-major": String(masterVersion.major),
          "kubernetes/master-version-minor": String(masterVersion.minor),
          "kubernetes/master-version-patch": String(masterVersion.patch),

          "kubernetes/node-version": nodeVersion.version,
          "kubernetes/node-version-major": String(nodeVersion.major),
          "kubernetes/node-version-minor": String(nodeVersion.minor),
          "kubernetes/node-version-patch": String(nodeVersion.patch),

          "kubernetes/autoscaling-enabled": autoscaling,
        }),
      },
    };
  });
};

export const getKubernetesNamespace = async (
  clusters: Array<{
    cluster: google.container.v1.ICluster;
    target: KubernetesClusterAPIV1;
  }>,
) => {
  gkeLogger.info("Coverting GKE clusters to namespaces");

  const namespaceTargets = clusters.map(async ({ cluster, target }) => {
    const kubeConfig = await connectToCluster(
      clusterClient,
      env.GOOGLE_PROJECT_ID,
      cluster.name!,
      cluster.location!,
    );
    const k8sApi = kubeConfig.makeApiClient(CoreV1Api);
    const namespaces = await k8sApi
      .listNamespace()
      .then((r) => r.body.items.filter((n) => n.metadata != null));
    return namespaces
      .filter(
        (n) =>
          !env.CTRLPLANE_GKE_NAMESPACE_IGNORE.split(",").includes(
            n.metadata!.name!,
          ),
      )
      .map((n) =>
        kubernetesNamespaceV1.parse(
          _.merge(_.cloneDeep(target), {
            kind: "Namespace",
            name: targetNamespaceName(n, cluster),
            identifier: `${env.GOOGLE_PROJECT_ID}/${cluster.name}/${n.metadata!.name}`,
            config: { namespace: n.metadata!.name },
            metadata: {
              "ctrlplane/parent-target-identifier": target.identifier,
              "kubernetes/namespace": n.metadata!.name,
            },
          }),
        ),
      );
  });

  return Promise.all(namespaceTargets).then((v) => v.flat());
};
