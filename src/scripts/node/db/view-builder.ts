import { DataBase, type dbType } from "./data-base.js";



interface View {

}

type Constructor = new (...args: any[]) => View;

export interface ViewConstructor extends Constructor {
    readonly name: string;

}

export class ViewBuilder {

    build(type: string) {
        


    }

    #loadDBFlatRecords(db: dbType) {
        DataBase.get
    }
}