/* Reviewed narrow bring-up policy. This is not general hardware or sensing validation. */
(function (root) {
  'use strict';
  const policy = Object.freeze({
    approved: false,
    firmwareVersion: '0.2.2-rc1',
    buildId: 'e085ac80bef63e23cb8185f4',
    selftestVersion: 1,
    maxSeconds: 5,
    approvalScope: 'Manual 1–5 second bring-up only; not general hardware validation',
  });
  if (typeof module === 'object' && module.exports) module.exports = policy;
  else root.OriginalRadarAcceptance = policy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
