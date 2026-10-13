// The state this website serves. Every page takes the name from here: the tab
// title, the headings, the sidebar and the footers. There is a copy of GEMS
// per state now (Rajasthan since 1 Oct 2026), so each says which one it is.
// A new state's copy changes this one line, plus STATE_NAME and SITE_HOST at
// the top of Code.gs, and nothing else.
var STATE_NAME = 'Rajasthan';
// The system's name (13 Oct 2026): GEMS – Government Engagement Management
// System. Pages put it in <span class="app-short"> and <span class="app-name">
// and {APP} in the title; APP_SHORT and APP_NAME in Code.gs match.
var APP_SHORT = 'GEMS';
var APP_NAME  = 'Government Engagement Management System';

(function () {
  // <title data-state-title="{APP} | {STATE} Analytics Portal">: the plain
  // title in the tag is what shows if this file ever fails to load.
  var t = document.querySelector('title[data-state-title]');
  if (t) document.title = t.getAttribute('data-state-title').replace('{STATE}', STATE_NAME).replace('{APP}', APP_SHORT);

  // <span class="state-name"></span> anywhere in the page gets the name, and
  // likewise app-short and app-name.
  function fill() {
    [['.state-name', STATE_NAME], ['.app-short', APP_SHORT], ['.app-name', APP_NAME]].forEach(function(p) {
      var els = document.querySelectorAll(p[0]);
      for (var i = 0; i < els.length; i++) els[i].textContent = p[1];
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill);
  else fill();
})();
