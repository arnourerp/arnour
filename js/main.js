/* ARNOUR — boot */
/* every click action and form goes through the access guard first, including calls made from the browser console */
(function () {
  const click = APP.onClick, submit = APP.onSubmit;
  APP.onClick = function (el, e) {
    const d = (el && el.dataset) || {};
    if (!APP.guardAction(d.action, d)) { if (e && e.preventDefault) e.preventDefault(); return; }
    return click.apply(this, arguments);
  };
  APP.onSubmit = function (f) {
    const d = (f && f.dataset) || {};
    if (!APP.guardAction(d.form, d)) return;
    return submit.apply(this, arguments);
  };
})();
document.addEventListener('DOMContentLoaded', () => APP.start());
