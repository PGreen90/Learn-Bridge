// Alert-bedömningen (är budet konstgjort och ska få ett "A" i auktionsvyn?) bor
// numera i REGELREGISTRET (`rules.ts`), så att budlogik, kravstatus och alert
// alla kommer från SAMMA regel (FAS 1). Den här filen är kvar som ett tunt,
// stabilt gränssnitt för auktionsvyn – importsökvägen ändras inte för konsumenter.

export { isAlertRule } from './rules'
