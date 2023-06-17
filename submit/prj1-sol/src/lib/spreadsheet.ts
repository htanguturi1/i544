import { json } from 'stream/consumers';
import parseExpr, {default as parse, CellRef, Ast } from './expr-parser.js';

import { Result, okResult, errResult } from 'cs544-js-utils';
import { clear } from 'console';

//factory method
export default async function makeSpreadsheet(name: string) :
  Promise<Result<Spreadsheet>>
{
  return okResult(new Spreadsheet(name));
}

type Updates = { [cellId: string]: number };

export class Spreadsheet {
   mastercell : {[id:string]:masterCellInfo}
  readonly name: string;
  //TODO: add other instance variable declarations  
  constructor(name: string) {
    this.name = name;
    this.mastercell={}
    //TODO: add initializations for other instance variables
  }

  /** Set cell with id cellId to result of evaluating formula
   *  specified by the string expr.  Update all cells which are
   *  directly or indirectly dependent on the base cell cellId.
   *  Return an object mapping the id's of all updated cells to
   *  their updated values.  
   *
   *  Errors must be reported by returning an error Result having its
   *  code options property set to `SYNTAX` for a syntax error and
   *  `CIRCULAR_REF` for a circular reference and message property set
   *  to a suitable error message.
   */

  async eval(cellId: string, expr: string) : Promise<Result<Updates>> {
    //TODO
    let ast = parseExpr(expr,cellId)
    //////console.log(ast)
    let evalResult:any
    if(!ast.isOk)
    {
      return errResult('expected syntax error',ast.errors[0].options.code)
    }
    //////console.log(this.getCellVariables(expr))
    let cellDependents: Set<string> = new Set<string>()
    cellDependents=this.getCellVariables(expr)

    let cellVar=this.getCellVariables(expr)
    if(cellVar.has(cellId)){
      //////console.log(this.getCellVariables(expr))
      return errResult('expected direct circular reference','CIRCULAR_REF')

    }
    for(const vari of cellVar)
    
    {
      console.log('dependents of ' + vari)
      if(this.mastercell[cellId] != null && 
         this.mastercell[cellId].dependents.length > 0)
      {
        // console.log(this.mastercell[vari].dependents)
        //console.log(vari)
      let bol=this.compareExp(vari,this.mastercell[cellId].dependents)
      if(bol)
      {
        return errResult('expected indirect circular reference','CIRCULAR_REF')
      }
    }
    }
    
    //////console.log(cellDependents)
    for (const item of cellDependents) {
     if(this.mastercell[item]==null){
      let newMaster:masterCellInfo={
        id:item,expr:'',value:0,dependents:new Array<String>(cellId)
      }
      this.mastercell={...this.mastercell, [item]: newMaster}

      continue
    }
    this.mastercell[item].dependents.push(cellId)
    }
   //////console.log(JSON.stringify(this.mastercell))

    if(ast.isOk){
      // ////console.log(ast.val)
      evalResult=this.evaluateAst(cellId,ast.val)
      // ////console.log(evalResult)
    }
    if(this.mastercell[cellId]==null){
    let newMaster:masterCellInfo={
      id:cellId,expr:expr,value:evalResult,dependents:[]
    }
    this.mastercell={...this.mastercell, [cellId]: newMaster}
    }
    else{
    this.mastercell[cellId].expr=expr
    this.mastercell[cellId].value=evalResult
  }
    
    
    let newCelldependents = new Array<String>()
    newCelldependents= this.mastercell[cellId].dependents
    let updatedDeps=this.evalDependents(newCelldependents)
    // ////console.log(JSON.stringify(this.mastercell))
   
   let json_obj :{[key:string]:any} = {
     [cellId] : evalResult

    }
    for(const dep of updatedDeps){
      json_obj={...json_obj,[dep]:this.mastercell[dep].value}
    }
  ////console.log(json_obj)
    return okResult(json_obj); //initial dummy result
  
  }
  compareExp(vari:string,depds:String[]): boolean{
    let match: boolean = false
    for(const depCheck of depds){
      if(vari===depCheck.toString())
      return true
      //console.log(depCheck)
      //console.log(this.mastercell[depCheck.toString()])
     if( this.mastercell[depCheck.toString()].dependents!=null && this.mastercell[depCheck.toString()].dependents.length > 0)
     {
      match=this.compareExp(vari,this.mastercell[depCheck.toString()].dependents)
      if(match){
      return true}
     }
    }
    return false

  }
    evalDependents(newCelldependents:Array<String>) :string[]
    {
      let changedDeps:string[]=[]
      ////console.log(newCelldependents)
      if(newCelldependents.length>0)
      {
        for(const  dep of newCelldependents)
        {
          ////console.log(dep)
          let expression=this.mastercell[dep.toString()].expr
          let ast = parseExpr(expression,dep.toString())
          ////console.log(ast)
          if (ast.isOk) {
            let value=this.evaluateAst(dep.toString(), ast.val);
            ////console.log(dep + '= ' + value.toString());
            this.mastercell[dep.toString()].value=value
            changedDeps.push(dep.toString())
            if(this.mastercell[dep.toString()].dependents.length>0)
            {
              changedDeps = [...changedDeps,...this.evalDependents(this.mastercell[dep.toString()].dependents)]
            }
            
          }
        }
      }
     return changedDeps
    }
  evaluateAst(cellId: string, astValue: Ast) {
    let x :number =0
    let y :number =0

      if(astValue.kind ==='num')
      {
        
        return astValue.value
      }
      else if(astValue.kind ==='ref')
      {
        
        const baseCellId=cellId
        let  refCellId=CellRef.parse(baseCellId)
        if(refCellId.isOk){
            let refCell=astValue.toText(refCellId.val)
           return this.mastercell[refCell].value
        }
      }
      else if(astValue.kind ==='app')
      {
        
        // ////console.log(astValue)
        
       let fn = astValue.fn
     
       if(astValue.kids.length==1)
       {
        if(astValue.kids[0].kind==='num')
        { 
          return -1 * astValue.kids[0].value
        }
        
       }
       
       if(astValue.kids[0].kind==='num')
        { 
          
          x = astValue.kids[0].value
          
        }
       else if(astValue.kids[0].kind==='ref')
          {
            
            const baseCellId=cellId
            let  refCellId=CellRef.parse(baseCellId)
            
            if(refCellId.isOk){
              let refCell=astValue.kids[0].toText(refCellId.val)
              
              
              if(this.mastercell[refCell] == null)
              {return 0}
              x = this.mastercell[refCell].value
              
              
            }
          }
       else if(astValue.kids[0].kind==='app')
          { 
            x= this.evaluateAst(cellId,astValue.kids[0])
            
          }
          if(astValue.kids[1].kind==='num')
          {
            
            y=astValue.kids[1].value
            
          }
       else if(astValue.kids[1].kind==='ref')
          { 
            const baseCellId=cellId
            let  refCellId=CellRef.parse(baseCellId)
            
            if(refCellId.isOk){
                let refCell=astValue.kids[1].toText(refCellId.val)
                
                if(this.mastercell[refCell] == null)
                {return 0}
              y = this.mastercell[refCell].value
              
              
            }
          }
       else if(astValue.kids[1].kind==='app')
          {  
            y = this.evaluateAst(cellId,astValue.kids[1])
           
          }
       
        return FNS[fn](x,y)

      }
      return 0
    
  }
  
getCellVariables(expr:string){
  let dependents: Set<string> = new Set<string>()
  let deps= expr.match(/[a-zA-Z][0-9]+/g)
  if(deps!= undefined && deps.length>0){
    deps.forEach(element => {
      dependents.add(element.trim())
    });

  }
  return dependents
}
}
class masterCellInfo {
   id: string
   expr: string
   ast? : Ast
   value: number
   dependents: Array<String>
  
   constructor (id: string,expr: string,value: number,ast? : Ast){
    this.id=id
    this.expr=expr
    this.ast=ast
    this.value=value
  }
}
//TODO: add additional classes and/or functions


const FNS = {
  '+': (a:number, b:number) : number => a + b,
  '-': (a:number, b?:number) : number => b === undefined ? -a : a - b,
  '*': (a:number, b:number) : number => a * b,
  '/': (a:number, b:number) : number => a / b,
  min: (a:number, b:number) : number => Math.min(a, b),
  max: (a:number, b:number) : number => Math.max(a, b),
}




