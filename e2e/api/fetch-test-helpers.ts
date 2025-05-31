import { annotationLabel } from "@aergonaut/playwright-opentelemetry-reporter";
import { expect, TestType } from "@playwright/test";
import { FetchResponse } from "openapi-fetch";

const fetchCountMap = new WeakMap<object, number>();

export interface FetchResultInfo {
    fetchResponse: FetchResponse<any, any, any>;
    requestBody?: any;
}

export function annotateFetch(
    test: TestType<any, any>,
    fetchResult: FetchResultInfo,
) {
    if (!fetchCountMap.has(test)) {
        fetchCountMap.set(test, 0);
    }
    const count = fetchCountMap.get(test)! + 1;
    fetchCountMap.set(test, count);
    const prefix = `api-${String(count).padStart(2, "0")}`;
    if (fetchResult.requestBody) {
        test.info().annotations.push({
            type: annotationLabel(`${prefix}.request.body`),
            description: JSON.stringify(fetchResult.requestBody),
        });
    }
    test.info().annotations.push({
        type: annotationLabel(`${prefix}.request.url`),
        description: fetchResult.fetchResponse.response.url,
    });
    test.info().annotations.push({
        type: annotationLabel(`${prefix}.response.status`),
        description: fetchResult.fetchResponse.response.status.toString(),
    });
    test.info().annotations.push({
        type: annotationLabel(`${prefix}.response.body`),
        description: JSON.stringify(fetchResult.fetchResponse.data),
    });
}

export function fetchResultHandler(
    test: TestType<any, any>,
    fetchResult: FetchResultInfo,
    expectedStatus: number | RegExp | undefined = undefined,
) {
    annotateFetch(test, fetchResult);
    const status = fetchResult.fetchResponse.response.status;
    if (expectedStatus instanceof RegExp) {
        expect(status.toString()).toMatch(
            expectedStatus,
        );
    } else if (expectedStatus !== undefined) {
        expect(status).toBe(expectedStatus);
    }
}

export function fetchResultListHandler(
    test: TestType<any, any>,
    fetchResults: FetchResultInfo[],
    expectedStatus: number | RegExp | undefined = undefined,
) {
    for (const fetchResult of fetchResults) {
        annotateFetch(test, fetchResult);
    }
    for (const fetchResult of fetchResults) {
        const status = fetchResult.fetchResponse.response.status;
        if (expectedStatus instanceof RegExp) {
            expect(status.toString()).toMatch(expectedStatus);
        } else if (expectedStatus !== undefined) {
            expect(status).toBe(expectedStatus);
        }
    }
}
