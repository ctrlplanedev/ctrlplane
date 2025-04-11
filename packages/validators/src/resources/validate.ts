import { isCloudVpcAPIV1 } from "./cloud-v1.js";
import { isKubernetesClusterAPIV1 } from "./kubernetes-v1.js";
import { isIdentifiable } from "./util.js";
import { isVmV1 } from "./vm-v1.js";

export const validateResource = (obj: object) => {
    // The object must be Identifable to be a valid resource
    if (!isIdentifiable(obj)) {
        throw new Error("Resource must have a version and kind");
    }

    // If each of these do not throw an error, it means one of the following:
    // 1. It could be a valid resource of one of the types below: correct kind/version AND with validated schema
    // 2. It is not a valid resource of any of the types below and will be treated as a generic resource
    isKubernetesClusterAPIV1(obj);
    isCloudVpcAPIV1(obj);
    isVmV1(obj);
};
