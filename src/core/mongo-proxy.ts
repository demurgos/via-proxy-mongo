import * as Promise from 'bluebird';
import * as _ from 'lodash';

import * as mongodb from "mongodb";
import {Proxy, ViaSchema, Cursor} from "./interfaces";
import {ReadOptions, UpdateOptions, UpdateOneOptions} from "./interfaces";

const TARGET = 'mongo';
const FORMAT = 'bson';

interface QueryCreate{}
interface QueryRead{}
interface bsonData{[key:string]: any}

interface ViaMinModel {
  _id: any;
  _rev: any;
  _created: any;
  _updated: any;
}

export class MongoProxy {
	format = FORMAT;
  target = TARGET;

  db: mongodb.Db = null;
  collectionName: string;

  constructor (db: mongodb.Db, collectionName:string) {
    this.db = db;
    this.collectionName = collectionName;
  }

  build(schema: ViaSchema): Promise<void>{
    return Promise.resolve();
  }

  create (data: Object): Promise<Object> {
    let date = new Date();
    // data._id = new mongodb.ObjectID();
    (<ViaMinModel> data)._rev = "1";
    (<ViaMinModel> data)._created = date;
    (<ViaMinModel> data)._updated = date;

    return this.getCollection()
      .then<mongodb.InsertOneWriteOpResult> ((coll: mongodb.Collection) => {
        return coll.insertOne(data, {forceServerObjectId: false});
      })
      .then<Object> ((wor: mongodb.InsertOneWriteOpResult) => {
        if (!wor.insertedCount) {
          return Promise.reject(new Error("Unable to insert"));
        }
        let doc: ViaMinModel = wor.ops[0];
        if (!doc._id) {
          return Promise.reject(new Error("Result does not expose _id"));
        }
        return doc;
      });
  }

  read (query: Object, options?: ReadOptions): Promise<mongodb.Cursor> {
		return this.getCollection()
			.then((coll: mongodb.Collection) => {
        let cursor: mongodb.Cursor = coll.find(query);
        return cursor;
			});
  }

  readById (id: mongodb.ObjectID): Promise<Object> {
		return this
      .read({_id: id})
      .then((cursor: mongodb.Cursor) => {
        return cursor.limit(1).next();
      })
      .then((doc: Object) => {
        if (doc === null) {
          throw new Error("Not found");
        }
        return doc;
      });
  }

  update (filter: Document, update: Object, options?: UpdateOptions): Promise<any> {
    return this.getCollection()
      .then((coll: mongodb.Collection) => {
        return coll.updateMany(filter, update, options);
      })
      .then((wor: mongodb.UpdateWriteOpResult) => {
        return {updatedCount: wor.modifiedCount};
      });
  }

  updateById (id: string, rev: string, update: Object, options?: UpdateOneOptions): Promise<any> {
    return this.getCollection()
      .then((coll: mongodb.Collection) => {
        return coll.updateOne({_id: id, _rev: rev}, update, options);
      })
      .then((wor: mongodb.UpdateWriteOpResult) => {
        if (!wor.matchedCount) {
          return Promise.reject(new Error("No match"));
        }
        if (!wor.modifiedCount) {
          return Promise.reject(new Error("No updates"));
        }
        return {updatedCount: wor.modifiedCount};
      });
  }

  delete (): Promise<any> {
    return Promise.resolve();
  }

  getCollection(): Promise<mongodb.Collection> {
    return Promise.resolve(this.db.collection(this.collectionName));
  }
}

export function viaToMongoUpdate (viaUpdate: Object): Promise<Object> {
  return Promise.resolve({"$set": viaUpdate});
}

export function asObjectID(id: string): mongodb.ObjectID {
  if (id instanceof mongodb.ObjectID) {
    return <mongodb.ObjectID> id;
  }
  if (!mongodb.ObjectID.isValid(id)) {
    throw new Error("Invalid id");
  }
  return new mongodb.ObjectID(id);
}
