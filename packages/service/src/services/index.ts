import { Kysely } from 'kysely';
import { DB } from '../data/types';
import { TestRunRepository } from './test-run-repository';
import { TestRunWorker, TestRunWorkerOld } from 'pact-conformance-test';
import config from '../config';

export interface Services {
  repository: TestRunRepository;
  worker: TestRunWorker;
  workerOld: TestRunWorkerOld;
}

export class ServiceContainer implements Services {

  repository: TestRunRepository;
  worker: TestRunWorker;
  workerOld: TestRunWorkerOld;

  constructor(db: Kysely<DB>) {
    this.repository = new TestRunRepository(db);
    this.worker = new TestRunWorker(this.repository, config.CONFORMANCE_API);
    this.workerOld = new TestRunWorkerOld(this.repository, config.CONFORMANCE_API);
  }

}
