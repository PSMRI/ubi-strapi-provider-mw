import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { encryptionMap } from './configs/encryption-map';
import { encrypt, decrypt } from './utils/encryption.util';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  constructor() {
    super();

    // Validate encryption key is available and properly formatted at startup
    if (!process.env.ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY environment variable is required for field encryption');
    }
    if (process.env.ENCRYPTION_KEY.length < 32) {
        throw new Error('ENCRYPTION_KEY must be at least 32 characters long for AES-256');
    }

    // Helper to decrypt fields for a given model using the encryption map
    function decryptModelFields(obj: any, model?: string) {
      if (!model || !encryptionMap[model]) return;
      for (const field of encryptionMap[model]) {
        if (obj[field] !== undefined && obj[field] !== null) {
          try {
            const decrypted = decrypt(obj[field]);
            if (decrypted !== null) {
              // Special handling for applicationData field - parse as JSON
              if (model === 'Applications' && field === 'applicationData') {
                try {
                  obj[field] = JSON.parse(decrypted);
                } catch (parseError) {
                  console.error(`Failed to parse JSON for field '${field}' in model '${model}':`, parseError.message);
                  obj[field] = {};
                }
              } else {
                obj[field] = decrypted;
              }
            } else {
              // If decryption fails, set field to null
              obj[field] = null;
            }
          } catch (e) {
            // Log decryption errors for debugging
            console.error(`Failed to decrypt field '${field}' in model '${model}':`, e.message);
            obj[field] = null;
          }
        }
      }
    }

    // Helper to find related model name from key (case-insensitive)
    function getRelatedModel(key: string): string | undefined {
      return Object.keys(encryptionMap).find(
        m => m.toLowerCase() === key.toLowerCase()
      );
    }

    // Recursively decrypts nested objects/arrays based on model
    function recursiveDecrypt(obj: any, model?: string) {
      if (Array.isArray(obj)) {
        return obj.map(item => recursiveDecrypt(item, model));
      }
      if (obj && typeof obj === 'object') {
        decryptModelFields(obj, model);
        for (const key of Object.keys(obj)) {
          const relatedModel = getRelatedModel(key);
          if (obj[key] && relatedModel) {
            obj[key] = recursiveDecrypt(obj[key], relatedModel);
          }
        }
      }
      return obj;
    }

    // Helper to extract data objects from params for encryption
    const extractDataObjects = (args: any): any[] => {
      const dataObjects: any[] = [];
      if (args?.data) {
        Array.isArray(args.data) ? dataObjects.push(...args.data) : dataObjects.push(args.data);
      }
      if (args?.create) dataObjects.push(args.create);
      if (args?.update) dataObjects.push(args.update);
      return dataObjects;
    };

    // Helper to encrypt fields in data objects
    const encryptFields = (dataObjects: any[], fields: string[], model: string) => {
      dataObjects.forEach(dataObj => {
        fields.forEach(field => {
          if (dataObj[field] !== undefined && dataObj[field] !== null) {
            try {
              dataObj[field] = encrypt(dataObj[field]);
            } catch (e) {
              console.error(`Failed to encrypt field '${field}' in model '${model}':`, e.message);
              throw new Error(`Encryption failed for field '${field}': ${e.message}`);
            }
          }
        });
      });
    };

    // Constants for actions
    const ENCRYPT_ACTIONS = ['create', 'update', 'upsert', 'createMany', 'updateMany'];
    const DECRYPT_ACTIONS = ['findUnique', 'findFirst', 'findMany', 'create', 'update', 'upsert'];

    // Prisma middleware for transparent encryption/decryption
    this.$use(async (params, next) => {
      const { model, action, args } = params;
      const fields = model ? encryptionMap[model] : undefined;

      // Encrypt fields before operations
      if (ENCRYPT_ACTIONS.includes(action) && fields && model) {
        const dataObjects = extractDataObjects(args);
        encryptFields(dataObjects, fields, model);
      }

      // Execute the operation
      const result = await next(params);

      // Decrypt fields after operations
      return DECRYPT_ACTIONS.includes(action) ? recursiveDecrypt(result, model) : result;
    });
  }
}
