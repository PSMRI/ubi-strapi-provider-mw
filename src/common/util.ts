// Utility functions for various tasks
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { UAParser } from 'ua-parser-js';
import { Request } from 'express';
import { FieldProperty, SectionProperty } from 'src/strapi-admin/interfaces';

export function titleCase(str) {
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
}

export function generateRandomString(length: number = 4): string {
    return crypto.randomBytes(length).toString('hex');
}

export function getBrowserInfo(userAgent: string) {
    const parser = new UAParser();
    const uaResult = parser.setUA(userAgent).getResult();
    return {
        browser: [uaResult.browser.name, uaResult.browser.version].filter(Boolean).join(' '),
        os: [uaResult.os.name, uaResult.os.version].filter(Boolean).join(' '),
    };
}

export function getAuthToken(req : Request): string {
    const authorization = req.headers['authorization'] ?? req.headers['Authorization'];
    if (!authorization || typeof authorization !== 'string') {
        throw new BadRequestException('Authorization header is required and must be a string');
    }
    return authorization;
}

export function convertPropertiesToFields(properties : SectionProperty[]): { fields: string[]; locales: string[] } {
  const result: { fields: string[]; locales: string[] } = {
      fields: [],
      locales: []
  };

  function extractFields(items: FieldProperty[], prefix = '') {
    items.forEach(item => {
      if (item.value === 'fields' && item.children) {
        // Process the fields section
        extractFields(item.children, '');
      } else if (item.value === 'locales' && item.children) {
        // Process the locales section
        item.children.forEach(locale => {
          result.locales.push(locale.value);
        });
      } else if (item.children && item.children.length > 0) {
        // Has nested children - create dot notation paths
        const currentPrefix = prefix ? `${prefix}.${item.value}` : item.value;
        extractFields(item.children, currentPrefix);
      } else {
        // Leaf field - add to fields array
        const fieldPath = prefix ? `${prefix}.${item.value}` : item.value;
        result.fields.push(fieldPath);
      }
    });
  }

  extractFields(properties);
  return result;
}

export function unsetObjectKeys<T extends object>(objectTag: T, keysToRemove: string[]): T | null {
  if (!objectTag) return null;

  function removeKeys(objectTag) {
    if (Array.isArray(objectTag)) {
    return objectTag.map(removeKeys);
    } else if (objectTag !== null && typeof objectTag === "object") {
    return Object.fromEntries(
      Object.entries(objectTag)
      .filter(([key]) => !keysToRemove.includes(key))
      .map(([key, value]) => [key, removeKeys(value)])
    );
    }
    
    return objectTag;
  }
  
  const cleanedObj = removeKeys(objectTag);

  return cleanedObj; // pretty format
  }
