/* ARNOUR — boot */
/* every click action and form goes through the access guard first, including calls made from the browser console */
(function () {
  /* APP._click / APP._submit are the inner handlers. A file that arrives later (js/admin.js, loaded only for an administrator)
     wraps these, so its actions still pass through the guard below. */
  APP._click = APP.onClick; APP._submit = APP.onSubmit;
  APP.onClick = function (el, e) {
    const d = (el && el.dataset) || {};
    if (!APP.guardAction(d.action, d)) { if (e && e.preventDefault) e.preventDefault(); return; }
    return APP._click.apply(this, arguments);
  };
  APP.onSubmit = function (f) {
    const d = (f && f.dataset) || {};
    if (!APP.guardAction(d.form, d)) return;
    return APP._submit.apply(this, arguments);
  };
})();
/* a clean entry page (/job/<id>) sets its own title, canonical and robots tags; once the person moves to another page, put the general ones back */
(function () {
  const home = { title: 'Arnour — SAP Talent & Consulting Network (MENA & Global)', canonical: 'https://arnour.com/' };
  window.addEventListener('hashchange', function () {
    try {
      if (/^#\/(job|company)\//.test(location.hash)) return;
      const c = document.querySelector('link[rel="canonical"]');
      if (c && c.getAttribute('href') !== home.canonical) c.setAttribute('href', home.canonical);
      if (/^Hiring: /.test(document.title)) document.title = home.title;
    } catch (e) { }
  });
})();
/* the page's own first-paint splash (index.html) goes as the app takes over, in the live and the demo copy alike */
document.addEventListener('DOMContentLoaded', () => { const bs = document.getElementById('boot-splash'); if (bs) bs.remove(); APP.start(); });
