import { type dbType } from "../db/data-base-types.js";



interface View {

}

type Constructor = new (...args: any[]) => View;

export interface ViewConstructor extends Constructor {
    readonly name: string;

}

export class ViewBuilder {

    build(type: string) {
        


    }

}