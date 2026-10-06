// Builds docs/_report_test.html: the real portal (report.html) with a stub in
// front that answers its three server calls with canned Rajasthan data, so the
// overview, district reports and stakeholders pages can be looked at without
// the web app. docs/_*.html is git-ignored; delete it after use.
//   node scripts/tests/make-report-harness.js   then open http://localhost:8765/_report_test.html
const fs = require('fs');
const src = fs.readFileSync('docs/report.html', 'utf8');

const STUB = `<script>
(function(){
  function d(offset) {
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var x = new Date(); x.setDate(x.getDate() + offset);
    return x.getDate() + ' ' + M[x.getMonth()] + ' ' + x.getFullYear();
  }
  // One post (District Coordinator) in two departments in BARAN: two offices.
  function M(id, dist, block, status, post, name, dept, off) {
    return { meetingId:id, district:dist, block:block, stakeholderBlock:block, status:status, date:d(off),
             conductDate: status === 'Conducted' ? d(off) : '', employeeName:'Seema Pankaj', post:'Program Coordinator',
             stakeholderName:name, stakeholderPost:post, department:dept, purpose:'Enrollment', meetingType:'One-on-One',
             momUrl:'', photoUrl:'', govtMom:'', outcome:'Commitment' };
  }
  var MEETINGS = [
    M('MTG-1','BARAN','ATRU','Conducted','District Coordinator','Ramesh Meena','Education Department',-20),
    M('MTG-2','BARAN','ATRU','Conducted','District Coordinator','Ramesh Meena','Education Department',-5),
    M('MTG-3','BARAN','ATRU','Conducted','District Coordinator','Sunita Jain',"CMO (Chief Minister's Office)",-3),
    M('MTG-4','BARAN','ATRU','Planned','Chief Block Education Officer/BEO','K.K Sharma','Education Department',2),
    M('MTG-5','UDAIPUR','GIRWA','Conducted','Child Development Project Officer','Asha Rawat','Women & Child Development',-2),
    M('MTG-6','UDAIPUR','GIRWA','Conducted','Chief Block Education Officer/BEO','Old Record','',-40)
  ];
  var STATS = { success:true, totals:{ total:6, conducted:5, planned:1, cancelled:0, postponed:0 },
    districts:[{ name:'Baran', total:4, conducted:3 }, { name:'Udaipur', total:2, conducted:2 }],
    byType:[{ name:'One-on-One', count:6 }], byPurpose:[{ name:'Enrollment', count:6 }], monthTrend:[],
    byDepartment:[{ name:'Education Department', total:3, conducted:2 }, { name:"CMO (Chief Minister's Office)", total:1, conducted:1 },
                  { name:'Women & Child Development', total:1, conducted:1 }],
    deptNotRecorded:1,
    recentConducted:[{ meetingId:'MTG-3', district:'BARAN', employeeName:'Seema Pankaj', post:'Program Coordinator',
      stakeholderName:'Sunita Jain', stakeholderPost:'District Coordinator', department:"CMO (Chief Minister's Office)",
      purpose:'Enrollment', meetingType:'One-on-One', conductDate:d(-3) }],
    activeEmployees:1, dtfSessions:0, momReady:0 };
  var R = {
    getDashboardStats: STATS,
    getReportData: { success:true, meetings:MEETINGS },
    getEmployeeMaster: { success:true, employees:[{ name:'Seema Pankaj', district:'BARAN', designation:'Program Coordinator' },
                                                  { name:'Summerveer Singh', district:'UDAIPUR', designation:'Program Coordinator' }] }
  };
  window.fetch = function(url) {
    var a = (/[?&]action=([^&]+)/.exec(url) || [])[1] || '';
    var body = R.hasOwnProperty(a) ? R[a] : { success:false };
    return new Promise(function(res){ setTimeout(function(){ res(new Response(JSON.stringify(body))); }, 60); });
  };
})();
</script>`;

const out = src.replace('<head>', '<head>\n' + STUB);
if (out === src) throw new Error('no <head> found');
fs.writeFileSync('docs/_report_test.html', out);
console.log('docs/_report_test.html written');
