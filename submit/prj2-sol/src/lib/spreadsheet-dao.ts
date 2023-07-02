import { Result, okResult, errResult } from 'cs544-js-utils';

import * as mongo from 'mongodb';

/** All that this DAO should do is maintain a persistent map from
 *  [spreadsheetName, cellId] to an expression string.
 *
 *  Most routines return an errResult with code set to 'DB' if
 *  a database error occurs.
 */

/** return a DAO for spreadsheet ssName at URL mongodbUrl */
export async function
makeSpreadsheetDao(mongodbUrl: string, ssName: string)
  : Promise<Result<SpreadsheetDao>> 
{
  return SpreadsheetDao.make(mongodbUrl, ssName);
}
type DbUser={_id?: mongo.ObjectId}
export class SpreadsheetDao {
  private client: mongo.MongoClient;
  private dbUrl:string
  private ssName: string;
  private cellInfo: mongo.Collection;

  
  constructor(params: { [key: string]: any }) {
    this.client = params.client;
    this.ssName = params.ssName;
    this.dbUrl=params.dbUrl;
    this.cellInfo = params.cellInfo;
  }  
  
  //factory method
  static async make(dbUrl: string, ssName: string)
    : Promise<Result<SpreadsheetDao>>
  {const params: { [key: string]: any } = {};
  try {
    params.client = await (new mongo.MongoClient(dbUrl)).connect();
      const db = params.client.db();
      const cells= db.collection(CELL_COLLECTION);
      params.cellInfo = cells;
      await cells.createIndex('cellId');
      await cells.createIndex('ssName');
      params.dbUrl=dbUrl
      params.ssName = ssName;
      return okResult(new SpreadsheetDao(params));
  }catch (e) {
    return errResult(e.message, 'DB');
    }
  
  }

  /** Release all resources held by persistent spreadsheet.
   *  Specifically, close any database connections.
   */
  async close() : Promise<Result<undefined>> {
    try {
      await this.client.close();
      return okResult(undefined);
    }
    catch (e) {
      return errResult(e.message, 'DB');
    }
  }

  /** return name of this spreadsheet */
  getSpreadsheetName() : string {
  
    return this.ssName;
  }

  /** Set cell with id cellId to string expr. */
  async setCellExpr(cellId: string, expr: string)
    : Promise<Result<undefined>>
  {
    try {
      const collection =this.cellInfo
      await collection.insertOne({cellId,expr})
    } catch (e) {
      return errResult(e.message, 'DB');
    }
    return okResult(undefined);
  }

  /** Return expr for cell cellId; return '' for an empty/unknown cell.
   */
  async query(cellId: string) : Promise<Result<string>> {
    try {
      
      const collection = this.cellInfo;
      const document = await collection.findOne({ cellId });
      const expr = document ? document.expr : '';
      return okResult(expr);
    }
    catch (e) {
      return errResult(e.message, 'DB');
    }
  }

  /** Clear contents of this spreadsheet */
  async clear() : Promise<Result<undefined>> {
    try {
    
      await this.cellInfo.deleteMany({});
      return okResult(undefined);
    } catch (e) {
      return errResult(e.message, 'DB');
    }
  }

  /** Remove all info for cellId from this spreadsheet. */
  async remove(cellId: string) : Promise<Result<undefined>> {
    try {
      const collection = this.cellInfo;
      await collection.deleteOne({cellId});
	    return okResult(undefined);
  
    }
    catch (e) {
      return errResult(e.message, 'DB');
    }
  }

  /** Return array of [ cellId, expr ] pairs for all cells in this
   *  spreadsheet
   */
  async getData() : Promise<Result<[string, string][]>> {
    try {
      const collection=this.cellInfo
      const docCollection= await collection.find({}).toArray();
      const docData :[string,string][]= docCollection.map((d) => [d.cellId, d.expr]);
      return okResult(docData);
    } catch (e) {
      return errResult(e.message, 'DB');
    }
  }

}

const CELL_COLLECTION='cells'


