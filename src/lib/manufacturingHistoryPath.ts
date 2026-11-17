/** Personal history is independent of current equipment admission; row/file APIs still authorize each read. */
export function manufacturingHistoryPath(path:string){
 return /^\/manufacturing\/(print|laser)(\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})?$/i.test(path);
}
