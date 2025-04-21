import * as Mustache from 'mustache';
import { v4 as uuidv4 } from 'uuid';
import { faker } from '@faker-js/faker';

/**
 * Template helper functions for use in YAML templates
 */
export const templateHelpers = {
  /**
   * Generate a unique run ID with optional prefix
   * Format: [prefix]-timestamp-random
   */
  runid: (prefix?: string) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
  },
  
  /**
   * Generate a UUID v4
   */
  uuid: () => uuidv4(),
  
  /**
   * Get current timestamp
   */
  timestamp: () => Date.now(),
  
  /**
   * Generate a random number between min and max
   */
  random: (min: number = 0, max: number = 1000) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  /**
   * Generate a random string
   */
  randomString: (length: number = 8) => {
    return faker.string.alphanumeric(length);
  },
  
  /**
   * Generate a random name (useful for resources)
   */
  randomName: (prefix?: string) => {
    const name = faker.word.sample();
    return prefix ? `${prefix}-${name}` : name;
  },
  
  /**
   * Generate a slug from a string (lowercase, no spaces)
   */
  slug: (str: string) => {
    return str.toLowerCase().replace(/\s+/g, '-');
  }
};

/**
 * Process all template values in an object using Mustache
 * This function recursively processes all string values in an object
 * looking for Mustache templates like {{ function() }}
 * 
 * @param obj The object to process
 * @param helpers Template helper functions
 * @returns The processed object with templates replaced with actual values
 */
export function processTemplateValues<T>(obj: T, helpers: Record<string, any>): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // If it's a string, process it with Mustache
  if (typeof obj === 'string') {
    // Only process if it contains a template
    if (obj.includes('{{')) {
      return Mustache.render(obj, helpers) as unknown as T;
    }
    return obj;
  }

  // If it's an array, process each element
  if (Array.isArray(obj)) {
    return obj.map(item => processTemplateValues(item, helpers)) as unknown as T;
  }

  // If it's an object, process each property
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processTemplateValues(value, helpers);
    }
    return result as T;
  }

  // For other types (number, boolean, etc.), return as is
  return obj;
}