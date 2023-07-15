import { SpreadsheetDao, makeSpreadsheetDao, } from 'cs544-prj2-sol';

import { MongoMemoryServer } from 'mongodb-memory-server';

import { assert, expect } from 'chai';


interface WrappedDao {
  mongod: MongoMemoryServer;
};

export default class MemSpreadsheetDao {

  static async setup() : Promise<SpreadsheetDao> {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    assert(mongod.instanceInfo, `mongo memory server startup failed`);
    const daoResult = await makeSpreadsheetDao(uri);
    assert(daoResult.isOk === true);
    const dao = daoResult.val;
    ((dao as unknown) as WrappedDao).mongod = mongod;
    return dao;
  }

  static async tearDown(dao: SpreadsheetDao) {
    await dao.close();
    const mongod = ((dao as unknown) as WrappedDao).mongod;
    await mongod.stop();
    assert(mongod.instanceInfo === undefined,
	   `mongo memory server stop failed`);
  }
}
