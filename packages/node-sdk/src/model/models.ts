import * as fs from "fs";
import localVarRequest from "request";

import { AcknowledgeJob200Response } from "./acknowledgeJob200Response";
import { CreateEnvironment200Response } from "./createEnvironment200Response";
import { CreateEnvironment200ResponseEnvironment } from "./createEnvironment200ResponseEnvironment";
import { CreateEnvironment500Response } from "./createEnvironment500Response";
import { CreateEnvironmentRequest } from "./createEnvironmentRequest";
import { CreateRelease200Response } from "./createRelease200Response";
import { CreateReleaseRequest } from "./createReleaseRequest";
import { DeleteTarget200Response } from "./deleteTarget200Response";
import { GetAgentRunningJob200ResponseInner } from "./getAgentRunningJob200ResponseInner";
import { GetJob200Response } from "./getJob200Response";
import { GetJob200ResponseApproval } from "./getJob200ResponseApproval";
import { GetJob200ResponseApprovalApprover } from "./getJob200ResponseApprovalApprover";
import { GetJob200ResponseDeployment } from "./getJob200ResponseDeployment";
import { GetJob200ResponseEnvironment } from "./getJob200ResponseEnvironment";
import { GetJob200ResponseRelease } from "./getJob200ResponseRelease";
import { GetJob200ResponseRunbook } from "./getJob200ResponseRunbook";
import { GetJob200ResponseTarget } from "./getJob200ResponseTarget";
import { GetNextJobs200Response } from "./getNextJobs200Response";
import { GetNextJobs200ResponseJobsInner } from "./getNextJobs200ResponseJobsInner";
import { GetTarget200Response } from "./getTarget200Response";
import { GetTarget200ResponseProvider } from "./getTarget200ResponseProvider";
import { GetTarget200ResponseVariablesInner } from "./getTarget200ResponseVariablesInner";
import { GetTarget404Response } from "./getTarget404Response";
import { GetTargetByIdentifier200Response } from "./getTargetByIdentifier200Response";
import { GetTargetByIdentifier200ResponseProvider } from "./getTargetByIdentifier200ResponseProvider";
import { GetTargetByIdentifier200ResponseVariablesInner } from "./getTargetByIdentifier200ResponseVariablesInner";
import { GetTargetByIdentifier404Response } from "./getTargetByIdentifier404Response";
import { SetTargetProvidersTargetsRequest } from "./setTargetProvidersTargetsRequest";
import { SetTargetProvidersTargetsRequestTargetsInner } from "./setTargetProvidersTargetsRequestTargetsInner";
import { UpdateJob200Response } from "./updateJob200Response";
import { UpdateJobAgent200Response } from "./updateJobAgent200Response";
import { UpdateJobAgentRequest } from "./updateJobAgentRequest";
import { UpdateJobRequest } from "./updateJobRequest";
import { UpdateTarget200Response } from "./updateTarget200Response";
import { UpdateTargetRequest } from "./updateTargetRequest";
import { UpsertTargetsRequest } from "./upsertTargetsRequest";
import { UpsertTargetsRequestTargetsInner } from "./upsertTargetsRequestTargetsInner";
import { UpsertTargetsRequestTargetsInnerVariablesInner } from "./upsertTargetsRequestTargetsInnerVariablesInner";
import { UpsertTargetsRequestTargetsInnerVariablesInnerValue } from "./upsertTargetsRequestTargetsInnerVariablesInnerValue";
import { V1JobAgentsAgentIdQueueAcknowledgePost200Response } from "./v1JobAgentsAgentIdQueueAcknowledgePost200Response";
import { V1JobAgentsAgentIdQueueAcknowledgePost401Response } from "./v1JobAgentsAgentIdQueueAcknowledgePost401Response";

export * from "./acknowledgeJob200Response";
export * from "./createEnvironment200Response";
export * from "./createEnvironment200ResponseEnvironment";
export * from "./createEnvironment500Response";
export * from "./createEnvironmentRequest";
export * from "./createRelease200Response";
export * from "./createReleaseRequest";
export * from "./deleteTarget200Response";
export * from "./getAgentRunningJob200ResponseInner";
export * from "./getJob200Response";
export * from "./getJob200ResponseApproval";
export * from "./getJob200ResponseApprovalApprover";
export * from "./getJob200ResponseDeployment";
export * from "./getJob200ResponseEnvironment";
export * from "./getJob200ResponseRelease";
export * from "./getJob200ResponseRunbook";
export * from "./getJob200ResponseTarget";
export * from "./getNextJobs200Response";
export * from "./getNextJobs200ResponseJobsInner";
export * from "./getTarget200Response";
export * from "./getTarget200ResponseProvider";
export * from "./getTarget200ResponseVariablesInner";
export * from "./getTarget404Response";
export * from "./getTargetByIdentifier200Response";
export * from "./getTargetByIdentifier200ResponseProvider";
export * from "./getTargetByIdentifier200ResponseVariablesInner";
export * from "./getTargetByIdentifier404Response";
export * from "./setTargetProvidersTargetsRequest";
export * from "./setTargetProvidersTargetsRequestTargetsInner";
export * from "./updateJob200Response";
export * from "./updateJobAgent200Response";
export * from "./updateJobAgentRequest";
export * from "./updateJobRequest";
export * from "./updateTarget200Response";
export * from "./updateTargetRequest";
export * from "./upsertTargetsRequest";
export * from "./upsertTargetsRequestTargetsInner";
export * from "./upsertTargetsRequestTargetsInnerVariablesInner";
export * from "./upsertTargetsRequestTargetsInnerVariablesInnerValue";
export * from "./v1JobAgentsAgentIdQueueAcknowledgePost200Response";
export * from "./v1JobAgentsAgentIdQueueAcknowledgePost401Response";

export interface RequestDetailedFile {
  value: Buffer;
  options?: {
    filename?: string;
    contentType?: string;
  };
}

export type RequestFile = string | Buffer | fs.ReadStream | RequestDetailedFile;

/* tslint:disable:no-unused-variable */
let primitives = [
  "string",
  "boolean",
  "double",
  "integer",
  "long",
  "float",
  "number",
  "any",
];

let enumsMap: { [index: string]: any } = {
  "GetJob200Response.StatusEnum": GetJob200Response.StatusEnum,
  "GetJob200ResponseApproval.StatusEnum": GetJob200ResponseApproval.StatusEnum,
};

let typeMap: { [index: string]: any } = {
  AcknowledgeJob200Response: AcknowledgeJob200Response,
  CreateEnvironment200Response: CreateEnvironment200Response,
  CreateEnvironment200ResponseEnvironment:
    CreateEnvironment200ResponseEnvironment,
  CreateEnvironment500Response: CreateEnvironment500Response,
  CreateEnvironmentRequest: CreateEnvironmentRequest,
  CreateRelease200Response: CreateRelease200Response,
  CreateReleaseRequest: CreateReleaseRequest,
  DeleteTarget200Response: DeleteTarget200Response,
  GetAgentRunningJob200ResponseInner: GetAgentRunningJob200ResponseInner,
  GetJob200Response: GetJob200Response,
  GetJob200ResponseApproval: GetJob200ResponseApproval,
  GetJob200ResponseApprovalApprover: GetJob200ResponseApprovalApprover,
  GetJob200ResponseDeployment: GetJob200ResponseDeployment,
  GetJob200ResponseEnvironment: GetJob200ResponseEnvironment,
  GetJob200ResponseRelease: GetJob200ResponseRelease,
  GetJob200ResponseRunbook: GetJob200ResponseRunbook,
  GetJob200ResponseTarget: GetJob200ResponseTarget,
  GetNextJobs200Response: GetNextJobs200Response,
  GetNextJobs200ResponseJobsInner: GetNextJobs200ResponseJobsInner,
  GetTarget200Response: GetTarget200Response,
  GetTarget200ResponseProvider: GetTarget200ResponseProvider,
  GetTarget200ResponseVariablesInner: GetTarget200ResponseVariablesInner,
  GetTarget404Response: GetTarget404Response,
  GetTargetByIdentifier200Response: GetTargetByIdentifier200Response,
  GetTargetByIdentifier200ResponseProvider:
    GetTargetByIdentifier200ResponseProvider,
  GetTargetByIdentifier200ResponseVariablesInner:
    GetTargetByIdentifier200ResponseVariablesInner,
  GetTargetByIdentifier404Response: GetTargetByIdentifier404Response,
  SetTargetProvidersTargetsRequest: SetTargetProvidersTargetsRequest,
  SetTargetProvidersTargetsRequestTargetsInner:
    SetTargetProvidersTargetsRequestTargetsInner,
  UpdateJob200Response: UpdateJob200Response,
  UpdateJobAgent200Response: UpdateJobAgent200Response,
  UpdateJobAgentRequest: UpdateJobAgentRequest,
  UpdateJobRequest: UpdateJobRequest,
  UpdateTarget200Response: UpdateTarget200Response,
  UpdateTargetRequest: UpdateTargetRequest,
  UpsertTargetsRequest: UpsertTargetsRequest,
  UpsertTargetsRequestTargetsInner: UpsertTargetsRequestTargetsInner,
  UpsertTargetsRequestTargetsInnerVariablesInner:
    UpsertTargetsRequestTargetsInnerVariablesInner,
  UpsertTargetsRequestTargetsInnerVariablesInnerValue:
    UpsertTargetsRequestTargetsInnerVariablesInnerValue,
  V1JobAgentsAgentIdQueueAcknowledgePost200Response:
    V1JobAgentsAgentIdQueueAcknowledgePost200Response,
  V1JobAgentsAgentIdQueueAcknowledgePost401Response:
    V1JobAgentsAgentIdQueueAcknowledgePost401Response,
};

// Check if a string starts with another string without using es6 features
function startsWith(str: string, match: string): boolean {
  return str.substring(0, match.length) === match;
}

// Check if a string ends with another string without using es6 features
function endsWith(str: string, match: string): boolean {
  return (
    str.length >= match.length &&
    str.substring(str.length - match.length) === match
  );
}

const nullableSuffix = " | null";
const optionalSuffix = " | undefined";
const arrayPrefix = "Array<";
const arraySuffix = ">";
const mapPrefix = "{ [key: string]: ";
const mapSuffix = "; }";

export class ObjectSerializer {
  public static findCorrectType(data: any, expectedType: string) {
    if (data == undefined) {
      return expectedType;
    } else if (primitives.indexOf(expectedType.toLowerCase()) !== -1) {
      return expectedType;
    } else if (expectedType === "Date") {
      return expectedType;
    } else {
      if (enumsMap[expectedType]) {
        return expectedType;
      }

      if (!typeMap[expectedType]) {
        return expectedType; // w/e we don't know the type
      }

      // Check the discriminator
      let discriminatorProperty = typeMap[expectedType].discriminator;
      if (discriminatorProperty == null) {
        return expectedType; // the type does not have a discriminator. use it.
      } else {
        if (data[discriminatorProperty]) {
          var discriminatorType = data[discriminatorProperty];
          if (typeMap[discriminatorType]) {
            return discriminatorType; // use the type given in the discriminator
          } else {
            return expectedType; // discriminator did not map to a type
          }
        } else {
          return expectedType; // discriminator was not present (or an empty string)
        }
      }
    }
  }

  public static serialize(data: any, type: string): any {
    if (data == undefined) {
      return data;
    } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
      return data;
    } else if (endsWith(type, nullableSuffix)) {
      let subType: string = type.slice(0, -nullableSuffix.length); // Type | null => Type
      return ObjectSerializer.serialize(data, subType);
    } else if (endsWith(type, optionalSuffix)) {
      let subType: string = type.slice(0, -optionalSuffix.length); // Type | undefined => Type
      return ObjectSerializer.serialize(data, subType);
    } else if (startsWith(type, arrayPrefix)) {
      let subType: string = type.slice(arrayPrefix.length, -arraySuffix.length); // Array<Type> => Type
      let transformedData: any[] = [];
      for (let index = 0; index < data.length; index++) {
        let datum = data[index];
        transformedData.push(ObjectSerializer.serialize(datum, subType));
      }
      return transformedData;
    } else if (startsWith(type, mapPrefix)) {
      let subType: string = type.slice(mapPrefix.length, -mapSuffix.length); // { [key: string]: Type; } => Type
      let transformedData: { [key: string]: any } = {};
      for (let key in data) {
        transformedData[key] = ObjectSerializer.serialize(data[key], subType);
      }
      return transformedData;
    } else if (type === "Date") {
      return data.toISOString();
    } else {
      if (enumsMap[type]) {
        return data;
      }
      if (!typeMap[type]) {
        // in case we dont know the type
        return data;
      }

      // Get the actual type of this object
      type = this.findCorrectType(data, type);

      // get the map for the correct type.
      let attributeTypes = typeMap[type].getAttributeTypeMap();
      let instance: { [index: string]: any } = {};
      for (let index = 0; index < attributeTypes.length; index++) {
        let attributeType = attributeTypes[index];
        instance[attributeType.baseName] = ObjectSerializer.serialize(
          data[attributeType.name],
          attributeType.type,
        );
      }
      return instance;
    }
  }

  public static deserialize(data: any, type: string): any {
    // polymorphism may change the actual type.
    type = ObjectSerializer.findCorrectType(data, type);
    if (data == undefined) {
      return data;
    } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
      return data;
    } else if (endsWith(type, nullableSuffix)) {
      let subType: string = type.slice(0, -nullableSuffix.length); // Type | null => Type
      return ObjectSerializer.deserialize(data, subType);
    } else if (endsWith(type, optionalSuffix)) {
      let subType: string = type.slice(0, -optionalSuffix.length); // Type | undefined => Type
      return ObjectSerializer.deserialize(data, subType);
    } else if (startsWith(type, arrayPrefix)) {
      let subType: string = type.slice(arrayPrefix.length, -arraySuffix.length); // Array<Type> => Type
      let transformedData: any[] = [];
      for (let index = 0; index < data.length; index++) {
        let datum = data[index];
        transformedData.push(ObjectSerializer.deserialize(datum, subType));
      }
      return transformedData;
    } else if (startsWith(type, mapPrefix)) {
      let subType: string = type.slice(mapPrefix.length, -mapSuffix.length); // { [key: string]: Type; } => Type
      let transformedData: { [key: string]: any } = {};
      for (let key in data) {
        transformedData[key] = ObjectSerializer.deserialize(data[key], subType);
      }
      return transformedData;
    } else if (type === "Date") {
      return new Date(data);
    } else {
      if (enumsMap[type]) {
        // is Enum
        return data;
      }

      if (!typeMap[type]) {
        // dont know the type
        return data;
      }
      let instance = new typeMap[type]();
      let attributeTypes = typeMap[type].getAttributeTypeMap();
      for (let index = 0; index < attributeTypes.length; index++) {
        let attributeType = attributeTypes[index];
        instance[attributeType.name] = ObjectSerializer.deserialize(
          data[attributeType.baseName],
          attributeType.type,
        );
      }
      return instance;
    }
  }
}

export interface Authentication {
  /**
   * Apply authentication settings to header and query params.
   */
  applyToRequest(requestOptions: localVarRequest.Options): Promise<void> | void;
}

export class HttpBasicAuth implements Authentication {
  public username: string = "";
  public password: string = "";

  applyToRequest(requestOptions: localVarRequest.Options): void {
    requestOptions.auth = {
      username: this.username,
      password: this.password,
    };
  }
}

export class HttpBearerAuth implements Authentication {
  public accessToken: string | (() => string) = "";

  applyToRequest(requestOptions: localVarRequest.Options): void {
    if (requestOptions && requestOptions.headers) {
      const accessToken =
        typeof this.accessToken === "function"
          ? this.accessToken()
          : this.accessToken;
      requestOptions.headers["Authorization"] = "Bearer " + accessToken;
    }
  }
}

export class ApiKeyAuth implements Authentication {
  public apiKey: string = "";

  constructor(
    private location: string,
    private paramName: string,
  ) {}

  applyToRequest(requestOptions: localVarRequest.Options): void {
    if (this.location == "query") {
      (<any>requestOptions.qs)[this.paramName] = this.apiKey;
    } else if (
      this.location == "header" &&
      requestOptions &&
      requestOptions.headers
    ) {
      requestOptions.headers[this.paramName] = this.apiKey;
    } else if (
      this.location == "cookie" &&
      requestOptions &&
      requestOptions.headers
    ) {
      if (requestOptions.headers["Cookie"]) {
        requestOptions.headers["Cookie"] +=
          "; " + this.paramName + "=" + encodeURIComponent(this.apiKey);
      } else {
        requestOptions.headers["Cookie"] =
          this.paramName + "=" + encodeURIComponent(this.apiKey);
      }
    }
  }
}

export class OAuth implements Authentication {
  public accessToken: string = "";

  applyToRequest(requestOptions: localVarRequest.Options): void {
    if (requestOptions && requestOptions.headers) {
      requestOptions.headers["Authorization"] = "Bearer " + this.accessToken;
    }
  }
}

export class VoidAuth implements Authentication {
  public username: string = "";
  public password: string = "";

  applyToRequest(_: localVarRequest.Options): void {
    // Do nothing
  }
}

export type Interceptor = (
  requestOptions: localVarRequest.Options,
) => Promise<void> | void;
