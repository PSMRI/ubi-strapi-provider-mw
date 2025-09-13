import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../src/utils/encryption.util';

const prisma = new PrismaClient();

// Configuration
const BATCH_SIZE = 10;
const DRY_RUN = process.env.DRY_RUN === 'true';

const encryptionKeyBase64 = process.env.ENCRYPTION_KEY;
if (!encryptionKeyBase64) {
  throw new Error('ENCRYPTION_KEY must be set in environment variables');
}

console.log(`🔧 Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE EXECUTION'}`);

function isAlreadyEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    const decrypted = decrypt(value);
    return decrypted !== null;
  } catch (error) {
    return false;
  }
}

async function processApplicationRecord(record: any) {
  const applicationId = record.id;
  const applicationData = record.applicationData;

  if (!applicationData) {
    console.log(`⏭️  Record ${applicationId}: applicationData is null/undefined, skipping`);
    return { id: applicationId, updateData: null, status: 'skipped_null' };
  }

  if (isAlreadyEncrypted(applicationData)) {
    console.log(`✅ Record ${applicationId}: applicationData is already encrypted, skipping`);
    return { id: applicationId, updateData: null, status: 'already_encrypted' };
  }

  try {
    // Encrypt as JSON string (not as parsed object)
    const dataToEncrypt = applicationData; // Keep as string
    
    // Validate JSON format but keep as string
    try {
      JSON.parse(applicationData);
      console.log(`📄 Record ${applicationId}: Valid JSON string - encrypting as string`);
    } catch (parseError) {
      console.log(`📝 Record ${applicationId}: Not valid JSON - encrypting raw string`);
    }

    const encryptedData = encrypt(dataToEncrypt);
    console.log(`🔐 Record ${applicationId}: Successfully encrypted applicationData`);
    
    return { 
      id: applicationId, 
      updateData: { applicationData: encryptedData }, 
      status: 'encrypted' 
    };

  } catch (error) {
    console.error(`❌ Record ${applicationId}: Encryption failed - ${error.message}`);
    return { id: applicationId, updateData: null, status: 'error' };
  }
}

async function encryptApplicationData() {
  let lastSeenId = 0;
  let totalProcessed = 0;
  let totalEncrypted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalAlreadyEncrypted = 0;

  console.log('\n🚀 Starting encryption process for Applications.applicationData...\n');

  while (true) {
    const records = await prisma.applications.findMany({
      where: { id: { gt: lastSeenId } },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      select: { id: true, applicationData: true }
    });

    if (!records.length) break;

    console.log(`📦 Processing batch: ${records.length} records (IDs ${records[0].id} - ${records[records.length - 1].id})`);

    const results = await Promise.all(
      records.map(record => processApplicationRecord(record))
    );

    results.forEach(result => {
      totalProcessed++;
      switch (result.status) {
        case 'encrypted': totalEncrypted++; break;
        case 'skipped_null': totalSkipped++; break;
        case 'already_encrypted': totalAlreadyEncrypted++; break;
        case 'error': totalErrors++; break;
      }
    });

    if (!DRY_RUN) {
      await prisma.$transaction(async tx => {
        for (const { id, updateData } of results) {
          if (updateData && Object.keys(updateData).length) {
            await tx.applications.update({
              where: { id },
              data: updateData,
            });
          }
        }
      });
      console.log(`💾 Updated ${results.filter(r => r.updateData).length} records in database`);
    } else {
      console.log(`🔍 DRY RUN: Would update ${results.filter(r => r.updateData).length} records`);
    }

    lastSeenId = records[records.length - 1].id;
    console.log(`📊 Progress: ${totalProcessed} processed, ${totalEncrypted} encrypted, ${totalAlreadyEncrypted} already encrypted, ${totalSkipped} skipped, ${totalErrors} errors\n`);
  }

  console.log('🎉 Encryption process completed!');
  console.log('📈 Final Statistics:');
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Successfully encrypted: ${totalEncrypted}`);
  console.log(`   Already encrypted: ${totalAlreadyEncrypted}`);
  console.log(`   Skipped (null data): ${totalSkipped}`);
  console.log(`   Errors: ${totalErrors}`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN - no data was actually modified');
    console.log('   To execute for real, run: DRY_RUN=false npx ts-node scripts/encrypt-application-data.ts');
  }
}

async function main() {
  try {
    await encryptApplicationData();
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('💥 Unexpected error:', err);
  process.exit(1);
});