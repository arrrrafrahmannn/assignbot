/** ASSIGNBOT public intake receiver for GitHub Pages.
 * Private Script Properties: FOLDER_ID and SPREADSHEET_ID.
 * All helper functions end in _ so visitors cannot invoke them through RPC.
 * No read/list/download endpoint is exposed. Uploads inherit the folder permissions.
 */
var ALLOWED_ORIGINS=['http://127.0.0.1:4173','http://localhost:5173','http://localhost:3000'];
function doGet(e){
 var origin=String(e&&e.parameter&&e.parameter.origin||''),channel=String(e&&e.parameter&&e.parameter.channel||'');
 if(ALLOWED_ORIGINS.indexOf(origin)<0||!/^[-a-f0-9]{36}$/i.test(channel))return HtmlService.createHtmlOutput('ASSIGNBOT upload connection. Open the ASSIGNBOT website to submit a brief.');
 var template=HtmlService.createTemplateFromFile('Bridge');template.originJson=JSON.stringify(origin);template.channelJson=JSON.stringify(channel);
 return template.evaluate().setTitle('ASSIGNBOT upload connection').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
var TAB_NAME='ASSIGNBOT Submissions';
var HEADERS=['Submission number','Submitted at','Name','Delivery method','Contact','Additional requirements','Original filename','Drive file link','Status','Request ID'];
function result_(value){return value;}
function safeText_(value){var text=String(value||'');return /^[=+\-@\t\r]/.test(text)?"'"+text:text;}
function sheet_(){var book=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));var sheet=book.getSheetByName(TAB_NAME);if(!sheet){sheet=book.insertSheet(TAB_NAME);sheet.appendRow(HEADERS);sheet.setFrozenRows(1);sheet.getRange(1,1,1,HEADERS.length).setFontWeight('bold').setBackground('#20221e').setFontColor('#ffffff');sheet.setColumnWidths(1,HEADERS.length,170);sheet.setColumnWidth(6,420);sheet.setColumnWidth(8,360);}return sheet;}
function initialize(){var lock=LockService.getScriptLock();lock.waitLock(30000);try{DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID')).getName();sheet_();}finally{lock.releaseLock();}}
function submitBrief(data){
 var lock=null,file=null,committed=false;
 try{
  if(!data||typeof data!=='object'||data.website)return {ok:false,code:'INVALID_REQUEST'};
  var props=PropertiesService.getScriptProperties();
  if(!/^[a-f0-9-]{36}$/i.test(data.requestId||''))return result_({ok:false,code:'INVALID_REQUEST'});
  if(typeof data.anonymous!=='boolean'||['gmail','whatsapp'].indexOf(data.channel)<0)return result_({ok:false,code:'INVALID_CONTACT'});
  if(data.anonymous&&data.channel!=='gmail')return result_({ok:false,code:'INVALID_CONTACT'});
  if(typeof data.contact!=='string'||(data.channel==='gmail'?!/^[^\s@]+@gmail\.com$/i.test(data.contact):!/^\+?[\d\s()-]{8,25}$/.test(data.contact)))return result_({ok:false,code:'INVALID_CONTACT'});
  if(!data.anonymous&&(typeof data.name!=='string'||!data.name.trim()||data.name.length>100))return result_({ok:false,code:'INVALID_NAME'});
  if(typeof data.requirements!=='string'||data.requirements.length>5000)return result_({ok:false,code:'INVALID_REQUIREMENTS'});
  var upload=data.file,types={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',txt:'text/plain'};
  if(!upload||typeof upload.name!=='string'||upload.name.length>200||typeof upload.base64!=='string'||!Number.isInteger(upload.size)||upload.size<1||upload.size>10485760||upload.base64.length>13981016)return result_({ok:false,code:'INVALID_FILE'});
  var ext=upload.name.split('.').pop().toLowerCase();if(!types[ext])return result_({ok:false,code:'INVALID_FILE'});
  var bytes=Utilities.base64Decode(upload.base64);if(bytes.length!==upload.size)return result_({ok:false,code:'INVALID_FILE'});
  var signatures={pdf:[37,80,68,70,45],doc:[208,207,17,224],docx:[80,75,3,4],png:[137,80,78,71,13,10,26,10],jpg:[255,216,255],jpeg:[255,216,255]};
  if(signatures[ext]&&!signatures[ext].every(function(v,i){return (bytes[i]&255)===v;}))return result_({ok:false,code:'INVALID_FILE'});
  lock=LockService.getScriptLock();if(!lock.tryLock(30000))return result_({ok:false,code:'BUSY'});
  var sheet=sheet_();
  if(sheet.getLastRow()>1){var match=sheet.getRange(2,10,sheet.getLastRow()-1,1).createTextFinder(data.requestId).matchEntireCell(true).findNext();if(match){var prior=sheet.getRange(match.getRow(),1,1,10).getValues()[0];return result_({ok:true,submissionId:prior[0],receivedAt:new Date(prior[1]).toISOString()});}}
  var today=Utilities.formatDate(new Date(),'UTC','yyyy-MM-dd');var dailyKey='daily_'+today;var daily=Number(props.getProperty(dailyKey)||0);if(daily>=200)return result_({ok:false,code:'DAILY_LIMIT'});
  if(data.channel==='whatsapp'&&(data.contact.replace(/\D/g,'').length<8||data.contact.replace(/\D/g,'').length>15))return result_({ok:false,code:'INVALID_CONTACT'});
  // Increment under the lock. Gaps after a failed upload are intentional; numbers are never reused.
  var previous=sheet.getLastRow()>1?String(sheet.getRange(sheet.getLastRow(),1,1,1).getValues()[0][0]):'';
  var lastSequence=/^AB-\d+$/.test(previous)?Number(previous.slice(3)):0;
  var sequence=Math.max(Number(props.getProperty('NEXT_SEQUENCE')||0),lastSequence)+1;props.setProperty('NEXT_SEQUENCE',String(sequence));
  var submissionId='AB-'+String(sequence).padStart(6,'0'),receivedAt=new Date();
  var cleanName=upload.name.replace(/[^a-zA-Z0-9._ -]/g,'_');
  var blob=Utilities.newBlob(bytes,types[ext],submissionId+'_'+cleanName);
  file=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID')).createFile(blob);
  sheet.appendRow([submissionId,receivedAt,data.anonymous?'Anonymous':safeText_(data.name),data.channel==='gmail'?'Gmail':'WhatsApp',safeText_(data.contact),safeText_(data.requirements),safeText_(upload.name),file.getUrl(),'New',data.requestId]);
  committed=true;SpreadsheetApp.flush();props.setProperty(dailyKey,String(daily+1));
  // Keep quota properties bounded across months of operation.
  Object.keys(props.getProperties()).filter(function(k){return k.indexOf('daily_')===0&&k!==dailyKey;}).forEach(function(k){props.deleteProperty(k);});
  return result_({ok:true,submissionId:submissionId,receivedAt:receivedAt.toISOString()});
 }catch(error){if(file&&!committed){try{file.setTrashed(true);}catch(ignored){}}return result_({ok:false,code:'SAVE_FAILED'});}
 finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
