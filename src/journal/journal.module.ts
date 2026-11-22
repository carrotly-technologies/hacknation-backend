import { Logger, Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { CryptoModule } from '../crypto/crypto.module.js';
import { FieldCipher } from '../crypto/field-cipher.js';
import { DemoModule } from '../demo/demo.module.js';
import { DATABASE, type Database } from '../database/database.js';
import { InMemoryJournalRepository } from './in-memory-journal.repository.js';
import { JournalController } from './journal.controller.js';
import { JournalRepository } from './journal.repository.js';
import { JournalService } from './journal.service.js';
import { PostgresJournalRepository } from './postgres-journal.repository.js';

@Module({
  imports: [CasesModule, DemoModule, CryptoModule],
  controllers: [JournalController],
  providers: [
    {
      provide: JournalRepository,
      inject: [DATABASE, FieldCipher],
      useFactory: async (
        db: Database | null,
        cipher: FieldCipher,
      ): Promise<JournalRepository> => {
        if (!db) return new InMemoryJournalRepository();
        const repo = new PostgresJournalRepository(db, cipher);
        const encrypted = await repo.encryptStoredText();
        if (encrypted.notes || encrypted.observations) {
          new Logger(JournalModule.name).log(
            `Encrypted stored text: ${encrypted.notes} notes, ${encrypted.observations} observations.`,
          );
        }
        return repo;
      },
    },
    JournalService,
  ],
  exports: [JournalRepository],
})
export class JournalModule {}
