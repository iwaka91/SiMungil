/**
 * SiMungil GAS Phase 1
 * Fokus: setup workbook master, bootstrap user/role/config, delta siswa,
 * rekap kehadiran, Catatan Harian dasar, tindak lanjut, dan 5 dokumen terbaru.
 *
 * KEAMANAN:
 * - TEST_TOKEN hanya untuk uji awal.
 * - Sebelum produksi wajib diganti Google Auth/ID token.
 */

const SHEETS = {
  USER: ['UserID','Email','Nama','Status','CreatedAt','UpdatedAt'],
  USER_ROLE: ['UserRoleID','UserID','Role','Value','Aktif','UpdatedAt'],
  SISWA: ['StudentID','NIS','NISN','Nama','Status','CreatedAt','UpdatedAt'],
  KELAS: ['KelasID','NamaKelas','Tingkat','TahunAjaranID','Aktif','UpdatedAt'],
  RIWAYAT_KELAS: ['EnrollmentID','StudentID','TahunAjaranID','KelasID','TanggalMulai','TanggalSelesai','Status','UpdatedAt'],
  JADWAL_PIKET: ['PicketID','Hari','UserID','TahunAjaranID','TanggalMulai','TanggalSelesai','Aktif','UpdatedAt'],
  TAHUN_AJARAN: ['TahunAjaranID','Nama','TanggalMulai','TanggalSelesai','Aktif','UpdatedAt'],
  CONFIG: ['Key','Value','UpdatedAt','UpdatedBy'],
  GEM: ['GemID','Nama','URL','Aktif','UpdatedAt'],
  SYNC_VERSION: ['Dataset','Version','UpdatedAt'],
  PENGUMUMAN: ['AnnouncementID','Judul','Isi','URL','TanggalMulai','TanggalSelesai','Aktif','UpdatedAt','UpdatedBy'],
  ABSENSI: ['AttendanceID','StudentID','EnrollmentID','Tanggal','Status','Keterangan','UpdatedAt','UpdatedBy'],
  CATATAN_HARIAN: ['NoteID','Tanggal','Jam','StudentID','EnrollmentID','Objek','Kategori','Peristiwa','Keterangan','PencatatUserID','PencatatEmail','PencatatNama','PencatatRole','TujuanJSON','PenerimaSnapshotJSON','Status','CreatedAt','UpdatedAt'],
  TINDAK_LANJUT: ['FollowUpID','ReferenceType','ReferenceID','UserID','Email','Nama','RoleSaatTindakLanjut','TanggalWaktu','Status','Catatan','KonfirmasiOleh','CreatedAt'],
  LAMPIRAN: ['AttachmentID','ReferenceType','ReferenceID','Type','Nama','FileId','URL','MimeType','Size','CreatedAt','CreatedBy'],
  NOTIFIKASI: ['NotificationID','RecipientUserID','RecipientEmail','Type','ReferenceType','ReferenceID','Judul','Isi','CreatedAt'],
  NOTIFIKASI_BACA: ['ReadID','NotificationID','UserID','ReadAt'],
  LOG_AKTIVITAS: ['LogID','Timestamp','UserID','Email','Aksi','Modul','Detail'],
  PRESTASI: ['PrestasiID','StudentID','EnrollmentID','Tanggal','Jenis','Tingkat','NamaPrestasi','Peringkat','Keterangan','AttachmentID','CreatedAt','CreatedBy'],
  POIN_DISIPLIN: ['PointID','StudentID','EnrollmentID','Tanggal','Jenis','Poin','CatatanID','Keterangan','CreatedAt','CreatedBy']
};

function doGet(e){
  return json_({ok:true,data:{app:'SiMungil GAS',phase:1,time:new Date().toISOString()}});
}

function doPost(e){
  try{
    const req = JSON.parse((e.postData && e.postData.contents) || '{}');
    checkToken_(req.token || '');
    const action = String(req.action || '');
    let data;
    switch(action){
      case 'health': data = {app:'SiMungil GAS',phase:1,time:new Date().toISOString()}; break;
      case 'bootstrap': data = bootstrap_(req.email); break;
      case 'studentsDelta': data = studentsDelta_(req.email, req.since || ''); break;
      case 'attendanceList': data = attendanceList_(req.email, req.start, req.end, req.className); break;
      case 'attendanceUpsert': data = attendanceUpsert_(req); break;
      case 'dailyNotesList': data = dailyNotesList_(req.email, req.start, req.end); break;
      case 'dailyNoteBatchCreate': data = dailyNoteBatchCreate_(req.email, req.records || []); break;
      case 'followupCreate': data = followupCreate_(req); break;
      case 'schoolDocs': data = schoolDocs_(req.email, Number(req.limit || 5)); break;
      case 'configSave': data = configSave_(req.email, req.config || {}); break;
      default: throw new Error('Action tidak dikenal: '+action);
    }
    return json_({ok:true,data});
  }catch(err){
    return json_({ok:false,error:String(err && err.message || err)});
  }
}

/** Jalankan SEKALI dari editor Apps Script setelah SIMUNGIL_SHEET_ID diset. */
function setupSiMungilSheets(){
  const ss = db_();
  Object.keys(SHEETS).forEach(name=>{
    let sh = ss.getSheetByName(name);
    if(!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    if(sh.getLastRow()===0){
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      sh.getRange(1,1,1,headers.length).setFontWeight('bold');
    }else{
      const existing = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getValues()[0];
      headers.forEach((h,i)=>{ if(existing[i]!==h) sh.getRange(1,i+1).setValue(h); });
    }
  });
  seedBaseConfig_();
  return 'OK: struktur SiMungil dibuat.';
}

/** Opsional: membuat master kelas standar jika sheet KELAS masih kosong. */
function seedDefaultClasses(){
  const sh=sheet_('KELAS');
  if(sh.getLastRow()>1) return 'KELAS sudah berisi data.';
  const rows=[
    ['K-X1','X 1','X','','TRUE',isoNow_()],
    ['K-X2','X 2','X','','TRUE',isoNow_()],
    ['K-X3','X 3','X','','TRUE',isoNow_()],
    ['K-XIA','XI A','XI','','TRUE',isoNow_()],
    ['K-XIB','XI B','XI','','TRUE',isoNow_()],
    ['K-XIC','XI C','XI','','TRUE',isoNow_()],
    ['K-XIIA','XII A','XII','','TRUE',isoNow_()],
    ['K-XIIB','XII B','XII','','TRUE',isoNow_()],
    ['K-XIIC','XII C','XII','','TRUE',isoNow_()]
  ];
  sh.getRange(2,1,rows.length,rows[0].length).setValues(rows);
  return '9 kelas dibuat.';
}

function bootstrap_(email){
  const ctx=userContext_(email);
  const cfg=configObject_();
  const directory=directory_();
  const announcements=rows_('PENGUMUMAN').filter(r=>truthy_(r.Aktif)).map(r=>({
    id:r.AnnouncementID,title:r.Judul,body:r.Isi,link:r.URL||'',
    start:dateOnly_(r.TanggalMulai),end:dateOnly_(r.TanggalSelesai),enabled:true
  }));
  return {
    user:{userId:ctx.user.UserID,email:ctx.user.Email,name:ctx.user.Nama,roles:ctx.roles,isAdmin:ctx.isAdmin},
    config:{
      schemaVersion:3,
      version:Number(syncVersions_().CONFIG || 0),
      school:{name:cfg.SCHOOL_NAME||'',contact:cfg.SCHOOL_CONTACT||'',address:cfg.SCHOOL_ADDRESS||''},
      gems:gemObject_(),
      links:{mainSheet:cfg.MAIN_SHEET_URL||'',schoolDrive:cfg.SCHOOL_DRIVE_URL||''}
    },
    directory,
    adminEmails:adminEmails_(),
    picket:picketObject_(),
    announcements,
    versions:syncVersions_()
  };
}

function studentsDelta_(email,since){
  userContext_(email);
  const sRows=rows_('SISWA'), eRows=rows_('RIWAYAT_KELAS'), kRows=rows_('KELAS');
  const classes=Object.fromEntries(kRows.map(r=>[String(r.KelasID),r]));
  const enrollByStudent={};
  eRows.filter(r=>String(r.Status||'').toLowerCase()==='aktif').forEach(r=>{
    const prev=enrollByStudent[r.StudentID];
    if(!prev || String(r.UpdatedAt||'')>String(prev.UpdatedAt||'')) enrollByStudent[r.StudentID]=r;
  });
  const sinceMs=since?Date.parse(since):0;
  const fullSync=!since || !isFinite(sinceMs);
  const upserts=[];
  sRows.forEach(s=>{
    const enr=enrollByStudent[s.StudentID]||null;
    const changed=Math.max(Date.parse(s.UpdatedAt||0)||0,Date.parse(enr && enr.UpdatedAt ||0)||0);
    if(fullSync || changed>sinceMs){
      upserts.push({
        studentId:s.StudentID,nis:String(s.NIS||''),nisn:String(s.NISN||''),name:s.Nama||'',
        class:enr&&classes[enr.KelasID]?classes[enr.KelasID].NamaKelas:'',
        enrollmentId:enr?enr.EnrollmentID:'',
        status:s.Status||'Aktif',
        updatedAt:new Date(changed||Date.now()).toISOString()
      });
    }
  });
  return {fullSync,version:isoNow_(),upserts};
}

function attendanceList_(email,start,end,className){
  userContext_(email);
  const students=studentDirectory_(), enroll=enrollmentDirectory_(), rows=rows_('ABSENSI');
  return {records:rows.filter(r=>{
    const d=dateOnly_(r.Tanggal);
    if(start&&d<start)return false;if(end&&d>end)return false;
    const e=enroll[r.EnrollmentID]||{},cl=e.className||'';
    if(className&&className!=='Semua'&&cl!==className)return false;
    return String(r.Status||'').toLowerCase()!=='hadir';
  }).map(r=>{
    const s=students[r.StudentID]||{}, e=enroll[r.EnrollmentID]||{};
    return {id:r.AttendanceID,date:dateOnly_(r.Tanggal),nisn:String(s.NISN||''),name:s.Nama||'',class:e.className||'',status:r.Status||'',note:r.Keterangan||''};
  })};
}

function attendanceUpsert_(req){
  const ctx=userContext_(req.email);
  const student=findStudentByNisn_(String(req.nisn||''));
  if(!student)throw new Error('NISN tidak ditemukan.');
  const enr=currentEnrollment_(student.StudentID);
  if(!enr)throw new Error('Siswa belum memiliki RIWAYAT_KELAS aktif.');
  const className=className_(enr.KelasID);
  if(!ctx.isAdmin && !ctx.roles.includes('Wali Kelas '+className)) throw new Error('Tidak berhak mengubah absensi kelas '+className+'.');
  const sh=sheet_('ABSENSI'), data=rows_('ABSENSI');
  const date=req.date||dateOnly_(new Date()), status=req.status||'Izin';
  const found=data.find(r=>r.StudentID===student.StudentID && r.EnrollmentID===enr.EnrollmentID && dateOnly_(r.Tanggal)===date);
  const now=isoNow_();
  if(found){
    const idx=found.__row;
    sh.getRange(idx,1,1,SHEETS.ABSENSI.length).setValues([[
      found.AttendanceID,student.StudentID,enr.EnrollmentID,date,status,req.note||'',now,ctx.user.Email
    ]]);
    return {id:found.AttendanceID,updated:true};
  }
  const id='ATT-'+Utilities.getUuid();
  append_('ABSENSI',[id,student.StudentID,enr.EnrollmentID,date,status,req.note||'',now,ctx.user.Email]);
  bumpVersion_('ABSENSI'); log_(ctx,'UPSERT','ABSENSI',id);
  return {id,created:true};
}

function dailyNotesList_(email,start,end){
  userContext_(email);
  const students=studentDirectory_(),enroll=enrollmentDirectory_();
  return {records:rows_('CATATAN_HARIAN').filter(r=>{
    const d=dateOnly_(r.Tanggal);return (!start||d>=start)&&(!end||d<=end);
  }).map(r=>{
    const s=students[r.StudentID]||{},e=enroll[r.EnrollmentID]||{};
    return {
      id:r.NoteID,date:dateOnly_(r.Tanggal),time:String(r.Jam||''),nisn:String(s.NISN||''),name:s.Nama||'',class:e.className||'',
      object:r.Objek||'',category:r.Kategori||'',title:r.Peristiwa||'',description:r.Keterangan||'',
      recorderName:r.PencatatNama||'',recorderEmail:r.PencatatEmail||'',recorderRole:r.PencatatRole||'',
      destinationTokens:parseJson_(r.TujuanJSON,[]),recipientSnapshot:parseJson_(r.PenerimaSnapshotJSON,[]),
      destination:'',status:r.Status||'Baru',sync:'sent',attachments:[],createdAt:toIso_(r.CreatedAt),updatedAt:toIso_(r.UpdatedAt)
    };
  })};
}

function dailyNoteBatchCreate_(email,records){
  const ctx=userContext_(email);const accepted=[];
  (records||[]).forEach(rec=>{
    const noteId='NOTE-'+Utilities.getUuid();
    let student=null,enr=null;
    if(rec.nisn){student=findStudentByNisn_(String(rec.nisn));if(student)enr=currentEnrollment_(student.StudentID);}
    append_('CATATAN_HARIAN',[
      noteId,rec.date||dateOnly_(new Date()),rec.time||'',student?student.StudentID:'',enr?enr.EnrollmentID:'',
      rec.object||'',rec.category||'',rec.title||'',rec.description||'',ctx.user.UserID,ctx.user.Email,ctx.user.Nama,
      rec.recorderRole||ctx.roles[0]||'',JSON.stringify(rec.destinationTokens||[]),JSON.stringify(rec.recipientSnapshot||[]),
      'Baru',isoNow_(),isoNow_()
    ]);
    accepted.push(rec.id);
    log_(ctx,'CREATE','CATATAN_HARIAN',noteId);
  });
  bumpVersion_('CATATAN_HARIAN');
  return {acceptedClientIds:accepted,count:accepted.length};
}

function followupCreate_(req){
  const ctx=userContext_(req.email);
  if(!req.note)throw new Error('Catatan tindak lanjut wajib diisi.');
  const id='FU-'+Utilities.getUuid(), now=isoNow_();
  append_('TINDAK_LANJUT',[id,req.referenceType||'',req.referenceId||'',ctx.user.UserID,ctx.user.Email,ctx.user.Nama,ctx.roles[0]||'',now,req.status||'',req.note||'','',now]);
  bumpVersion_('TINDAK_LANJUT');log_(ctx,'CREATE','TINDAK_LANJUT',id);
  return {id};
}

function schoolDocs_(email,limit){
  userContext_(email);
  const cfg=configObject_(), folderId=cfg.SCHOOL_DRIVE_FOLDER_ID||'';
  if(!folderId)return {files:[]};
  const folder=DriveApp.getFolderById(folderId),it=folder.getFiles(),files=[];
  while(it.hasNext()){
    const f=it.next();
    files.push({name:f.getName(),mimeType:f.getMimeType(),updatedAt:f.getLastUpdated().toISOString(),url:f.getUrl()});
  }
  files.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return {files:files.slice(0,Math.max(1,Math.min(limit||5,20)))};
}

function configSave_(email,c){
  const ctx=userContext_(email);if(!ctx.isAdmin)throw new Error('Hanya Admin aplikasi.');
  const map={
    SCHOOL_NAME:c.school&&c.school.name||'',SCHOOL_CONTACT:c.school&&c.school.contact||'',SCHOOL_ADDRESS:c.school&&c.school.address||'',
    MAIN_SHEET_URL:c.links&&c.links.mainSheet||'',SCHOOL_DRIVE_URL:c.links&&c.links.schoolDrive||''
  };
  Object.keys(map).forEach(k=>setConfig_(k,map[k],ctx.user.Email));
  (c.adminEmails||[]).slice(0,4).forEach((v,i)=>setConfig_('ADMIN_EMAIL_'+(i+1),v||'',ctx.user.Email));
  const gems=c.gems||{};
  upsertGem_('cp','Analisis CP - TP - ATP',gems.cp||'');
  upsertGem_('rpp','Generator RPP',gems.rpp||'');
  upsertGem_('kisi','Generator Kisi-Kisi dan Soal',gems.kisi||'');
  upsertGem_('lkpd','Generator LKPD',gems.lkpd||'');
  bumpVersion_('CONFIG');
  return {config:bootstrap_(email).config};
}

/* ---------------- helpers ---------------- */

function checkToken_(token){
  const expected=PropertiesService.getScriptProperties().getProperty('SIMUNGIL_TEST_TOKEN')||'';
  if(!expected)throw new Error('SIMUNGIL_TEST_TOKEN belum diset pada Script Properties.');
  if(token!==expected)throw new Error('Token uji GAS tidak valid.');
}
function db_(){
  const id=PropertiesService.getScriptProperties().getProperty('SIMUNGIL_SHEET_ID');
  if(!id)throw new Error('SIMUNGIL_SHEET_ID belum diset pada Script Properties.');
  return SpreadsheetApp.openById(id);
}
function sheet_(name){const sh=db_().getSheetByName(name);if(!sh)throw new Error('Sheet '+name+' belum ada. Jalankan setupSiMungilSheets().');return sh;}
function rows_(name){
  const sh=sheet_(name);const values=sh.getDataRange().getValues();if(values.length<2)return [];
  const h=values[0].map(String);
  return values.slice(1).map((row,i)=>{const o={__row:i+2};h.forEach((k,j)=>o[k]=row[j]);return o;});
}
function append_(name,row){sheet_(name).appendRow(row);}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function isoNow_(){return new Date().toISOString();}
function toIso_(v){if(!v)return'';const d=v instanceof Date?v:new Date(v);return isNaN(d)?String(v):d.toISOString();}
function dateOnly_(v){
  if(!v)return'';
  const d=v instanceof Date?v:new Date(v);
  if(isNaN(d))return String(v).slice(0,10);
  return Utilities.formatDate(d,Session.getScriptTimeZone()||'Asia/Jakarta','yyyy-MM-dd');
}
function truthy_(v){return v===true||String(v).toLowerCase()==='true'||String(v)==='1';}
function parseJson_(s,fallback){try{return JSON.parse(String(s||''))}catch{return fallback}}
function userContext_(email){
  email=String(email||'').trim().toLowerCase();if(!email)throw new Error('Email wajib.');
  const users=rows_('USER');const user=users.find(r=>String(r.Email||'').toLowerCase()===email && String(r.Status||'Aktif').toLowerCase()==='aktif');
  if(!user)throw new Error('Email belum terdaftar/aktif pada USER.');
  const roles=rows_('USER_ROLE').filter(r=>r.UserID===user.UserID&&truthy_(r.Aktif)).map(r=>String(r.Role||'')).filter(Boolean);
  return {user,roles,isAdmin:adminEmails_().map(x=>x.toLowerCase()).includes(email)};
}
function directory_(){
  const users=Object.fromEntries(rows_('USER').filter(u=>String(u.Status||'Aktif').toLowerCase()==='aktif').map(u=>[u.UserID,u]));
  return rows_('USER_ROLE').filter(r=>truthy_(r.Aktif)&&users[r.UserID]).map(r=>({
    email:String(users[r.UserID].Email||''),name:users[r.UserID].Nama||'',role:r.Role||'',active:true
  }));
}
function adminEmails_(){const c=configObject_();return [1,2,3,4].map(i=>String(c['ADMIN_EMAIL_'+i]||'').trim()).filter(Boolean);}
function configObject_(){const o={};rows_('CONFIG').forEach(r=>o[String(r.Key||'')]=r.Value);return o;}
function setConfig_(key,value,by){
  const sh=sheet_('CONFIG'), rows=rows_('CONFIG'), found=rows.find(r=>String(r.Key)===key), now=isoNow_();
  if(found) sh.getRange(found.__row,1,1,4).setValues([[key,value,now,by||'']]);
  else append_('CONFIG',[key,value,now,by||'']);
}
function gemObject_(){
  const out={cp:'',rpp:'',kisi:'',lkpd:''};
  rows_('GEM').filter(r=>truthy_(r.Aktif)).forEach(r=>{if(out.hasOwnProperty(String(r.GemID)))out[String(r.GemID)]=String(r.URL||'')});
  return out;
}
function upsertGem_(id,name,url){
  const sh=sheet_('GEM'),rows=rows_('GEM'),f=rows.find(r=>String(r.GemID)===id),row=[id,name,url,!!url,isoNow_()];
  if(f)sh.getRange(f.__row,1,1,5).setValues([row]);else append_('GEM',row);
}
function syncVersions_(){const o={};rows_('SYNC_VERSION').forEach(r=>o[String(r.Dataset)]=r.Version);return o;}
function bumpVersion_(dataset){
  const sh=sheet_('SYNC_VERSION'),rows=rows_('SYNC_VERSION'),f=rows.find(r=>String(r.Dataset)===dataset),v=Date.now(),now=isoNow_();
  if(f)sh.getRange(f.__row,1,1,3).setValues([[dataset,v,now]]);else append_('SYNC_VERSION',[dataset,v,now]);
}
function picketObject_(){
  const users=Object.fromEntries(rows_('USER').map(u=>[u.UserID,u])),out={Senin:'',Selasa:'',Rabu:'',Kamis:'',Jumat:'',Sabtu:''};
  rows_('JADWAL_PIKET').filter(r=>truthy_(r.Aktif)).forEach(r=>{
    const u=users[r.UserID];if(!u||!out.hasOwnProperty(r.Hari))return;
    out[r.Hari]+=(out[r.Hari]?',':'')+String(u.Email||'');
  });return out;
}
function studentDirectory_(){return Object.fromEntries(rows_('SISWA').map(s=>[s.StudentID,s]));}
function enrollmentDirectory_(){
  const classes=Object.fromEntries(rows_('KELAS').map(k=>[k.KelasID,k])),o={};
  rows_('RIWAYAT_KELAS').forEach(e=>o[e.EnrollmentID]={...e,className:classes[e.KelasID]?classes[e.KelasID].NamaKelas:''});
  return o;
}
function findStudentByNisn_(nisn){return rows_('SISWA').find(s=>String(s.NISN||'')===String(nisn))||null;}
function currentEnrollment_(studentId){return rows_('RIWAYAT_KELAS').filter(r=>r.StudentID===studentId&&String(r.Status||'').toLowerCase()==='aktif').sort((a,b)=>String(b.UpdatedAt||'').localeCompare(String(a.UpdatedAt||'')))[0]||null;}
function className_(classId){const r=rows_('KELAS').find(x=>x.KelasID===classId);return r?r.NamaKelas:'';}
function log_(ctx,action,module,detail){append_('LOG_AKTIVITAS',['LOG-'+Utilities.getUuid(),isoNow_(),ctx.user.UserID,ctx.user.Email,action,module,String(detail||'')]);}
function seedBaseConfig_(){
  const base={
    SCHOOL_NAME:'SMA Negeri 3 Maliku',
    SCHOOL_ADDRESS:'Kecamatan Maliku, Kabupaten Pulang Pisau, Kalimantan Tengah',
    SCHOOL_CONTACT:'',
    MAIN_SHEET_URL:'',
    SCHOOL_DRIVE_URL:'',
    SCHOOL_DRIVE_FOLDER_ID:'',
    ADMIN_EMAIL_1:'',ADMIN_EMAIL_2:'',ADMIN_EMAIL_3:'',ADMIN_EMAIL_4:''
  };
  const existing=configObject_();
  Object.keys(base).forEach(k=>{if(existing[k]===undefined)setConfig_(k,base[k],'setup')});
  ['CONFIG','SISWA','ABSENSI','CATATAN_HARIAN','TINDAK_LANJUT'].forEach(ds=>{
    const versions=syncVersions_();if(versions[ds]===undefined)bumpVersion_(ds);
  });
}