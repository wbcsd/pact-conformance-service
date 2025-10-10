import { Kysely } from 'kysely';
import { DB } from '../data/types';
import { TestRunRepository } from './test-run-repository';
import { TestRunWorker } from './test-run-worker';
import { EventHandler } from './event-handler';

export interface Services {
  repository: TestRunRepository;
  worker: TestRunWorker;
  eventHandler: EventHandler;
}

export class ServiceContainer implements Services {

  repository: TestRunRepository;
  worker: TestRunWorker;
  eventHandler: EventHandler;

  constructor(db: Kysely<DB>) {
    this.repository = new TestRunRepository(db);
    this.worker = new TestRunWorker(this.repository);
    this.eventHandler = new EventHandler(this.repository);
  }
  
}
